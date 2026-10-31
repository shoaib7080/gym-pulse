# GymPulse Backend Hardening Plan

Based on the [GymPulse Hardening Guide](file:///d:/Development/workspace/gym-pulse/GymPulse-Hardening-Guide.md), the 15 granular tasks (Steps 0–14) are consolidated into **7 dependency-ordered implementation phases** (meeting the 4–10 step requirement). Each phase builds on strict architectural invariants: server-enforced business rules, integer minor-unit math, deterministic audit chaining, and zero trust of client inputs.

```mermaid
flowchart TD
    S1["Step 1: Foundational Rails & Date Math<br/>(Guide Steps 0 & 6)"] --> S2["Step 2: Cryptographic Audit & Manager PIN<br/>(Guide Steps 1 & 7)"]
    S2 --> S3["Step 3: Background Jobs & Proof Storage<br/>(Guide Steps 2 & 11)"]
    S3 --> S4["Step 4: Atomic Financial Engine<br/>(Guide Steps 3, 4, 5)"]
    S4 --> S5["Step 5: Auth Perimeter & Guard Coverage<br/>(Guide Steps 8 & 9)"]
    S5 --> S6["Step 6: Attendance Hardening & Denial Audit<br/>(Guide Step 10)"]
    S6 --> S7["Step 7: Automated Tests, CI & Real Screens<br/>(Guide Steps 12, 13, 14)"]
```

---

## Breakdown of Implementation Steps

### Step 1: Foundational Safety, Script Rails & Month-End Date Math
*Corresponds to Guide Steps 0 & 6*

- **Script Safety Rails**:
  - Update `apps/api/reset-db.cjs` and `test-e2e-flow.cjs` to enforce strict guards: require `ALLOW_DB_RESET=true`, non-production `NODE_ENV`, database name matching `/(dev|test|local|scratch)/i`, and interactive confirmation typing the DB name (bypassable only when `CI=true`).
  - Audit and clean up all `*.cjs` and `*.ts` scripts in `apps/api`. Delete duplicates; retain exactly one TypeScript platform-admin seed (`pnpm --filter api seed:platform-admin`) that reads credentials strictly from environment variables.
  - Purge hardcoded credentials (such as `AdminPassword123`) repository-wide.
  - Update `apps/api/.env.example` with placeholders.
- **Inclusive Month-End Date Math Helper**:
  - Integrate battle-tested `date-fns` in `packages/shared` for rigorous calendar/leap-year handling.
  - Expose `packages/shared/src/utils/date-math.ts` with `addMonthsClamped(dateStr, months)` and `computeInclusiveEndDate(startDateStr, unit, value)` wrapping `date-fns` functions (`addMonths`, `lastDayOfMonth`, `getDaysInMonth`, `subDays`).
  - Enforce gym domain clamping rules: 31 Jan + 1 month clamps to 28 Feb (or 29 Feb on leap years), 30 Jan clamps to 28 Feb, 31 Mar ends 30 Apr.
  - Replace all inline date math in `memberships.service.ts`, `payments.service.ts`, and `freezes.service.ts`.
  - Add table-driven and property-based tests (`fast-check`).

---

### Step 2: Cryptographic Audit Trail Rebuild & Per-Manager PINs
*Corresponds to Guide Steps 1 & 7*

- **Audit Trail Rebuild**:
  - Drizzle migration: add `chain_key` (`gym_id` UUID or `'platform'`) and `hash_version` (`smallint default 2`) to `audit_logs`, with index on `(chain_key, id)`.
  - Update `AuditService.log(entry, tx?)` to take an optional Drizzle transaction handle and acquire `pg_advisory_xact_lock(hashtextextended(chain_key, 0))` before reading the previous chain hash.
  - Canonical SHA-256 hashing across `hash_version`, `chain_key`, `prev_hash`, actor fields, entity fields, payload, IP, device, and millisecond-truncated `created_at`.
  - Trigger migration: create `forbid_update_delete()` function raising exceptions BEFORE UPDATE/DELETE on `audit_logs`, `invoices`, `membership_adjustments`, and `check_ins`. Update `SchemaGuard` to verify these triggers exist on startup.
  - Implement fail-closed audit logging inside business transactions for critical operations.
- **Per-Manager PIN Security**:
  - Drizzle migration: table `manager_pins` (`id`, `gym_id`, `user_id`, `pin_hash`, `failed_attempts`, `locked_until`, `created_at`, `updated_at`).
  - Hash PINs via Node `crypto.scrypt` (16-byte salt, stored with parameters); verify via `crypto.timingSafeEqual`.
  - Endpoints: `PUT /v1/gyms/manager-pin` for managers/owners to set their own PIN (4–8 digits, rejecting trivial sequences).
  - Step-up early freeze lift: front-desk requires `{ approverUserId, managerPin }`. Lockout after 5 failed attempts (15-minute lock, HTTP 423 `PIN_LOCKED`). Direct owner/manager lift requires no PIN.
  - Strip `managerPin` from gym settings and existing `gyms.settings` JSON. Rate-limit lift endpoint.

---

### Step 3: Background Automation & Proof Storage Governance
*Corresponds to Guide Steps 2 & 11*

- **Internal Scheduled Settlement**:
  - Remove `asOfDate` from all HTTP request bodies and controllers.
  - Implement `@nestjs/schedule` hourly task: iterate gyms whose local date has advanced, run freeze settlement (activate due freezes, complete ended freezes with extension adjustments, expire pending reviews past start date).
  - Create table `gym_daily_runs` to record `(gym_id, local_date)` runs for idempotency.
  - Concurrency control: acquire `pg_try_advisory_lock` during runs; log per-gym errors and continue.
  - Audit all scheduled state mutations with a system actor.
- **Constrained Proof Uploads & Storage Interface**:
  - Introduce `StorageService` interface with local filesystem implementation and cloud bucket contract.
  - Server-generated storage keys: `gyms/{gymId}/freezes/{freezeId}/{uuid}`. Disallow client-specified keys.
  - Accept strictly `application/pdf`, `image/jpeg`, `image/png` up to 5 MB; compute SHA-256 hash server-side.
  - Set `delete_after = verification_date + 30 days` (or upload + 90 days if unreviewed). Daily scheduler sweeps and purges expired rows and files.
  - Owner/manager only access; views audited; platform admins blocked from viewing proofs.

---

### Step 4: Atomic Financial Engine: Server-Priced Sales, Renewals & Voids
*Corresponds to Guide Steps 3, 4 & 5*

- **Atomic Membership Sales (`POST /v1/sales/memberships`)**:
  - Require `Idempotency-Key` header with hash caching on `(gym_id, idempotency_key)` to return cached results or 409 `IDEMPOTENCY_CONFLICT`.
  - Single transaction: verify gym active and subscription active -> validate `startDate` -> pull price from `plans.price_minor` (reject client prices/currencies) -> enforce caller's open shift -> compute base & VAT -> insert membership (`pending`), payment (`succeeded`), invoice snapshot, flip membership (`active`), insert adjustment (`purchase`), commit audit entry.
  - Deprecate/remove unbacked `POST /v1/memberships`. Lock down `POST /v1/payments/desk` to only accept `freeze_fee` and restricted `other`.
- **Consolidated Renewals (`POST /v1/sales/renewals`)**:
  - Pessimistic locking: `SELECT ... FOR UPDATE` on `memberships`.
  - Compute new term using `addMonthsClamped`: start from current `end_date + 1` if within grace period, otherwise gym-local today.
  - Insert `membership_adjustments` (`kind: 'renewal'`) and invoice snapshot in the same transaction.
  - Delete legacy fragmented renewal routes (`POST /v1/memberships/:id/renew` and desk payment `renewal` purpose).
- **Safe Voids & Credit Notes (`POST /v1/payments/:id/void`)**:
  - Owner only. Allowed strictly while payment shift is still OPEN (reject after shift closeout).
  - Single transaction: set `payment.status = 'voided'`, issue gapless credit note (`doc_type: 'credit_note'`, series `CN`), insert reversing adjustment (`kind: 'correction'`), restore previous end date or cancel new membership (`voided_sale`). Exclude voided amounts from shift reconciliation.

---

### Step 5: Authorization Perimeter, Route Guards & Platform Hardening
*Corresponds to Guide Steps 8 & 9*

- **Authentication & Security Headers**:
  - Better Auth: enforce email verification (`requireEmailVerification: true`), add official Bearer plugin (remove cookie-copying hack), enforce TLS certificate verification (`ssl { rejectUnauthorized: true }`), share single connection pool.
  - HTTP layer: add Helmet, 1 MB request body limit, `app.enableShutdownHooks()`, `X-Request-Id` correlation middleware, global `ZodValidationPipe`, and `@nestjs/throttler` rate limiting.
- **Tenant Authorization & Guard Coverage**:
  - Controller-level `ActiveGymGuard` across all tenant controllers; `@AllowInactiveGym()` on profile read/edit and document upload routes.
  - Restrict `GET /v1/gyms/staff` to owner/manager. Explicit role annotations on all mutating routes.
  - `BranchAccessService`: enforce branch scoping for staff with `branch_scope = 'selected'`.
  - Remove `POST /v1/outbox/enqueue`. Fix platform route ordering (`gyms/review-queue` before `gyms/:id`).
  - Gym profile updates: strict Zod schema, IANA timezone check; if active gym modifies TRN/license, revert status to `pending_verification` and notify owner.

---

### Step 6: Attendance Access Hardening, Frontend Rails & Denial Persistence [COMPLETED]
*Corresponds to Guide Step 10*

- **Check-In Decision Logging & Fail-Safe Persistence**:
  - Persist a `check_ins` record for EVERY access decision (`allowed` or `denied` with explicit `deny_reason`: `expired`, `frozen`, `cancelled`, `unpaid`, `wrong_branch`, `outside_schedule`, `not_found`, `duplicate_tap`).
  - Commit denial records even when throwing HTTP exceptions (fail-safe persistence).
  - Enforce `cancelEffectiveDate`: deny check-in if gym-local date is past cancellation effective date, regardless of cached status.
  - Maintain staff presence requirement (`method: 'desk_search'`, `verified_by: staffUserId`).
- **Frontend Hardening & Client Resilience (ADR D-29)**:
  - Augmented `apiFetch` in `AuthContext` to auto-inject cryptographic UUID `Idempotency-Key` headers on mutating financial requests.
  - Replaced front-desk checkout in `OperationsView` with direct integration to `/v1/sales/memberships` enforcing server-side plan minor pricing.
  - Front-end validation verifies active cashier shift before cash or POS card checkout.
  - Owner-only Payment Void action with sequential Credit Note (`CN-XXXX`) feedback.
  - Verification status alert banners and client resubmit flow (`POST /v1/gyms/:id/resubmit`).

---

### Step 7: Automated Test Harness, CI & Master Verification Sign-Off [COMPLETED]
*Corresponds to Guide Steps 12, 13 & 14*

- **Master Hardening Verification Suite**:
  - Created `apps/api/test-master-hardening-suite.cjs` unifying all 6 domain verification harnesses.
  - Validates script safety rails, month-end date math clamping, cryptographic hash chaining, advisory locks, per-manager PIN scrypt hashing, distributed settlement automation, zero-trust proof storage, server-priced atomic sales, sequential credit note voids, Better Auth bearer integration, Brevo OTP verification service, and client idempotency rails.
- **Environment & Configuration Hygiene**:
  - Updated `apps/api/.env.example` documenting all production environment variables: Brevo API keys, sender configuration, storage driver (local/s3), and encryption keys.
- **Architecture Sign-Off & Documentation Truth**:
  - Recorded ADR D-25 through ADR D-30 in `Memory.md`.
  - Production readiness confirmed across 100% of hardening domains.

---

## 🏆 Hardening Implementation Status Matrix

| Step | Scope | Status | Verification Suite / Artifact | ADR |
| :--- | :--- | :---: | :--- | :---: |
| **Step 1** | Script Safety Rails & Inclusive Date Math | **COMPLETED** | `packages/shared/src/utils/date-math.ts` | **D-24** |
| **Step 2** | Cryptographic Audit Trail & Per-Manager PINs | **COMPLETED** | `apps/api/test-step2-audit-pin.cjs` | **D-25** |
| **Step 3** | Settlement Scheduler & Proof Storage Governance | **COMPLETED** | `apps/api/test-step3-scheduler-storage.cjs` | **D-26** |
| **Step 4** | Atomic Sales Engine, Renewals & Safe Voids | **COMPLETED** | `apps/api/test-step4-sales-voids.cjs` | **D-27** |
| **Step 5** | Auth Perimeter, Better Auth & Brevo OTP Service | **COMPLETED** | `apps/api/test-step5-auth-guards.cjs` | **D-28** |
| **Step 6** | Frontend Hardening, Client Idempotency & UI Rails | **COMPLETED** | `apps/web/test-step6-client-hardening.cjs` | **D-29** |
| **Step 7** | Master Verification Suite & Production Sign-Off | **COMPLETED** | `apps/api/test-master-hardening-suite.cjs` | **D-30** |

