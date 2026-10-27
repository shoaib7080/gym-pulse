# GymPulse Project Memory & Architecture Context

> **Purpose:** Authoritative reference for architecture, security models, database schemas, implemented flows, and future milestones for the **GymPulse Platform**.

---

## 📌 1. Project Overview & Core Value Proposition

- **Product:** GymPulse — Production-grade Multi-Tenant SaaS for independent gyms, boutique clubs, and multi-branch chains across the UAE, GCC, and India.
- **Specification:** GymPulse Platform Specification (49 pages, October 2026).
- **Core Pillars:**
  - **Strict Multi-Tenant Scoping:** Zero cross-gym data leakage enforced at the database query layer (`tenant-scope.helper.ts`).
  - **Cryptographic Audit Integrity:** Tamper-evident append-only audit trail protected by SHA-256 hash chains (`audit_logs` + `AuditService` with deterministic `canonicalStringify`).
  - **Automated GCC & India Tax Compliance:** UAE VAT (5% in integer fils, round-half-up, 15-digit TRN) and Indian GST compatibility.
  - **Dynamic Multi-Provider Payments:** Direct merchant settlement via dynamic configuration objects supporting **Tap Payments** for GCC (AED, SAR) and **Razorpay** for India (INR), with Stripe deferred.
  - **Policy-Controlled Membership Engine:** Inclusive business date math, tamper-evident adjustment ledgers, and automated freeze/expiry extensions.
  - **Shift-Based Cashier Reconciliation:** Blind drawer closeouts with automated minor unit variance calculations.
  - **Gym License Verification & Active Gym Guard:** Unverified gyms (`pending_verification`) are blocked from creating new branches, registering members, creating plans, selling memberships, and processing sales via `ActiveGymGuard`. Profile editing and document uploading remain permitted while pending. Platform Administration manages the review queue, approval, and rejection with mandatory reason and email notifications.

---

## ⚖️ 2. Deviations from Specification

The following deliberate architectural deviations have been implemented to enhance reliability, security, flexibility, and developer ergonomics:

- **Payment Provider Architecture:**
  - _Spec Definition:_ Hardcoded Stripe Connect columns (`stripe_account_id`, `stripe_onboarding_completed`, etc.).
  - _Current Implementation:_ Platform-Master Keys in Secrets Manager + Linked Provider Account IDs in `gym_payment_accounts`. The JSON column `payment_provider_config` on `gyms` has been completely removed.
  - _Rationale:_ Eliminates per-gym plain secrets in database. Matches standard marketplace/route architectures (e.g., Razorpay Route linked accounts, Tap merchant IDs, Stripe Connect). Any interim sensitive secrets are encrypted with AES-256-GCM at rest, settable only by the gym owner, never returned via API, and audited without logging secrets.

- **Owner Verification Gate & 1-Gym Cap:**
  - _Spec Definition:_ Unverified gyms could provision branches up to subscription tier.
  - _Current Implementation:_ Strict `ActiveGymGuard` blocks unverified gyms (`pending_verification`) from creating new branches, registering members, creating plans, selling memberships, and processing sales. Profile editing (`PATCH /v1/gyms/profile`) and document uploads (`POST /v1/gyms/documents`) are permitted while pending. Furthermore, a single user may create and own strictly one gym during Phase 1 (`GYM_CREATION_LIMIT_EXCEEDED`).
  - _Rationale:_ Quality assurance, anti-fraud, and compliance: ensures no commercial operations or member intake can proceed prior to platform KYC verification of trade licenses and TRNs.

- **User ID Types & Identity Model (Implemented as specified in Phase A3):**
  - _Spec Definition:_ `uuid` for all user identifiers across domain tables (`users.id`, `staff_assignments.user_id`, `members.user_id`, `shifts.opened_by`/`closed_by`, `membership_adjustments.created_by`, `platform_admins.user_id`, etc.).
  - _Current Implementation:_ `users.id` is a `uuid` primary key with default `gen_random_uuid()`. Better Auth tables retain high-entropy NanoID strings (`auth_user.id`), linked via `users.auth_user_id` (nullable, unique foreign key). All tenant and platform tables strictly reference `users.id` (`uuid`). Front-desk registered members receive a domain `users` row with `auth_user_id: null` (no login credentials created).
  - _Rationale:_ Exactly matches project specification. Separates auth credential storage from domain profile entities while enforcing relational integrity across all business tables.

- **Auth Table Naming:**
  - _Spec Definition:_ Pluralized / custom table names: `users`, `sessions`, `refresh_tokens`, `accounts`.
  - _Current Implementation:_ Singular names for auth infrastructure: `auth_user`, `auth_session`, `auth_account`, `auth_verification`.
  - _Rationale:_ Framework standard: conforms to Better Auth's official Drizzle adapter schema conventions and isolates authentication mechanics from domain tables (`users`).

- **Platform Admin Architecture (Enforced with Role Guard in Phase A4):**
  - _Spec Definition:_ `platform_admin` was listed as a single role enum alongside `owner`, `manager`, `front_desk`.
  - _Current Implementation:_ Dedicated `platform_admins` table referencing `users.id` (`uuid`) with distinct 3-tier sub-roles: `superadmin`, `support`, `auditor`, enforced via `@PlatformRoles(...)` and `PlatformRolesGuard`. Only `superadmin` can approve, reject, suspend, or reactivate gyms and promote or remove admins. `support` and `auditor` can read overview data and audit trail only.
  - _Rationale:_ Zero-trust multi-tenancy: separates platform-level governance from tenant data, with strict role enforcement.

- **Authentication Flow (Phase 1):**
  - _Spec Definition:_ JWT tokens with rotating refresh tokens and SMS phone OTP for members.
  - _Current Implementation:_ Session-based Better Auth cookies / Bearer tokens with Email & Password.
  - _Rationale:_ Phase 1 MVP scope: phone OTP and SMS carriers are deferred to Phase 2 to eliminate third-party SMS gateway failures and recurring carrier costs during core commercial validation.

- **CSRF / Origin Handling (Phase A1):**
  - _Spec Definition:_ Strict browser Origin and Referer validation on every mutating request.
  - _Current Implementation:_ `disableCSRFCheck: false` in development and production (enabled only when `NODE_ENV === 'test'` for automated test harness), `trustedOrigins` dynamically populated from `TRUSTED_ORIGINS` environment variable, and secure cookies enabled in production (`useSecureCookies: process.env.NODE_ENV === 'production'`).
  - _Rationale:_ Completely removes CSRF bypass while enabling flexible origin whitelisting across local dev, staging, and production domains.

---

## 🏛️ 3. Architectural Decisions Log (ADRs)

1. **ADR D-1 (Backend Stack):** NestJS 10 + Drizzle ORM + Neon PostgreSQL. Modular architecture, strict TypeScript types, declarative guards, pooled serverless PostgreSQL connection.
2. **ADR D-2 (Authentication):** Better Auth (Self-Hosted). Replaces external hosted auth. Uses Drizzle adapter against Neon DB (`auth_user`, `auth_session`, `auth_account`). Strictly Email & Password in Phase 1 (no SMS/OTP).
3. **ADR D-3 (Environment Strategy):** Single `.env` in `apps/api/.env`. No duplicate root `.env` files. NestJS ConfigModule and scripts explicitly load `apps/api/.env`.
4. **ADR D-4 (Admin Separation):** Split Table & Route Tree. Platform Superadmins (`platform_admins`, `/v1/platform/*`) are strictly separated from Gym Admins/Staff (`staff_assignments`, `/v1/gyms/*`). Both share `auth_user` for identity.
5. **ADR D-5 (Tenant Isolation):** Session + `x-gym-id` + `TenantGuard`. Client provides target gym via `x-gym-id` header. `TenantGuard` cryptographically verifies caller has an active role in `staff_assignments`.
6. **ADR D-6 (Multi-Provider Payments & Secrets Vaulting):** Platform Keys in Secrets Manager + Linked Account IDs in `gym_payment_accounts`. Gyms store strictly provider account IDs (`provider_account_id` in `gym_payment_accounts`). Platform master credentials live in environment / secrets manager (`PlatformSecretsService`). `payment_provider_config` deleted from `gyms`. Interim secrets protected by AES-256-GCM envelope encryption, owner-only access, never returned on read, and changes audited without secrets.
7. **ADR D-7 (Financial Math):** Integer Minor Units & Round-Half-Up. Money stored as integer minor units (fils/paise). Formula: `base = round_half_up(total * 10000 / (10000 + vat_rate_bps))`. No floating-point math.
8. **ADR D-8 (Date Math):** Inclusive Business Dates (`YYYY-MM-DD`). Evaluated in `gyms.timezone`. End dates are inclusive: `days = end_date - start_date + 1`. End dates mutate strictly through the adjustments ledger.
9. **ADR D-9 (Audit Hash Integrity):** Deterministic Recursive Canonical Serialization. SHA-256 hash chains use recursive key-sorting (`canonicalStringify`) to guarantee identical hashes regardless of PostgreSQL `jsonb` column key reordering.
10. **ADR D-10 (Owner Verification Gate & 1-Gym Cap):** ActiveGymGuard on Mutating Routes. Gyms in `pending_verification` are gated by `ActiveGymGuard` from creating branches, members, plans, memberships, or transactions. Profile editing and document uploading remain active. Platform admins review applications via `GET /v1/platform/review-queue` and approve/reject with mandatory reasons (`POST /approve`, `POST /reject`), triggering transactional email notifications to owners. Users are capped at creating exactly 1 gym.
11. **ADR D-11 (Blind Cash Drawer Reconciliation):** Blind Closeout Formula. Cashiers submit counted cash without being shown system expected cash. Server computes `expected = float + cashSales` and logs variance in fils.
12. **ADR D-12 (Invoice Sequencing):** Gapless Tenant-Scoped Sequential Invoices. Invoices generate gapless sequential codes: `INV-000001`, `INV-000002` per gym for tax authority compliance.
13. **ADR D-13 (Migrations Only & Disposable Dev Data):** Schema Changes Exclusively via Drizzle Kit. No runtime schema patching and zero ad-hoc `.cjs` migration scripts. Schema changes go strictly through `pnpm --filter api db:generate` -> review SQL -> `pnpm --filter api db:migrate`. Development data is disposable: `pnpm --filter api db:reset` drops and recreates the public schema to allow clean re-application of migrations anytime.
14. **ADR D-14 (Explicit Currency on Every Money Row & Strict Tenant Scoping):** Currency on Every Money Row & Universal GymId. Every table row holding financial values (`plans`, `freeze_policies`, `membership_freezes`, `shifts`, `payments`, `invoices`, `gym_payment_accounts`) stores an explicit 3-letter currency code (`AED`, `SAR`, `INR`) in integer minor units (no floats). Every tenant table contains `gym_id` (including `staff_branch_access`), and all queries on tenant data must go through `scopeToGym` or `scopeEntityToGym`.
15. **ADR D-15 (Turnstile Hardware De-scoping for MVP):** Physical Turnstile Hardware Cut from Phase 1. Physical turnstile integrations, on-premise relay bridges (ZKTeco/Hikvision), and onsite network adapters are completely de-scoped from Phase 1 (MVP) to eliminate network latency risks and deployment friction. Phase 1 relies strictly on high-speed software desk scanning (USB/Bluetooth HID barcode/QR scanner or browser webcam) and Ctrl+K desk search. In the Owner Dashboard, a high-converting button and callout banner ("Want automated turnstile gates? Request hardware quote.") capture enterprise interest as a Phase 2 add-on while development focuses directly on core commercial logic: payments, renewals, freeze engine, and member retention.
16. **ADR D-16 (PostgreSQL GIST Exclusion Constraint for Freeze Non-Overlap & Back-to-Back Protection):** Database-Level Overlap & Adjacency Protection. Rule 9 is enforced at the database kernel level using PostgreSQL `btree_gist` and an exclusion constraint: `EXCLUDE USING gist (membership_id WITH =, daterange(start_date, (end_date + integer '1'), '[]') WITH &&) WHERE (status IN ('pending', 'scheduled', 'active'))`. Extending the upper bound by `+ 1` ensures that back-to-back freezes (where freeze 2 starts on freeze 1's `end_date + 1`) collide on that single boundary date, blocking both direct overlaps and adjacent back-to-back submissions concurrently without race conditions. Database violations (`23P01`, `23505`) are caught and mapped directly to `ConflictException({ code: 'FREEZE_OVERLAP' })`.
17. **ADR D-17 (Strict Freeze Eligibility, Segregation of Duties & Proof Retention):** Zero Backdating & Anti-Tamper Policies. Past start dates are unconditionally rejected (`FREEZE_START_IN_PAST`); `startDate <= today` strictly means `today`. Notice waivers are restricted to `owner` or `manager` with audit trail recording. The remaining-balance exception applies strictly when `requestedDays === remainingDays`. Stale approvals where the start date has passed are rejected (`APPROVAL_STALE`). Self-approval of freeze requests is prohibited (`SELF_APPROVAL_PROHIBITED`). Medical proofs carry a 30-day post-verification retention schedule (`delete_after = today + 30`) purgeable via `POST /v1/freezes/purge-proofs`. Active freezes block member archiving (`LIVE_FREEZE_ACTIVE`).
18. **ADR D-18 (Desk Early Lift, PIN Confidentiality & Concurrency Protection):** Server-Enforced Date & Dual Concurrency Guard. Early lift effective date is server-enforced as `today` (immune to client tampering). Boundaries: pre-start lifts cancel the freeze with 0 charged; lifts on/after end date trigger normal completion. Double-lift race conditions are protected both by query state checking (`eq(status, 'active')`) and a PostgreSQL unique index `adjustment_once_per_freeze` on `(membership_id, freeze_id)`. Manager PIN is verified on step-up and authorizing manager `userId` is recorded; the PIN itself is never logged.
19. **ADR D-19 (Payment-Backed Renewals, Invariant Frozen Status & Notice Cancellations):** Financial Integrity on Term Changes. Membership renewals (`POST /v1/memberships/:id/renew`) are executed in one atomic transaction requiring desk sale payment, tax invoice generation, and a `membership_adjustments` row linking `payment_id` (preventing free unearned time). If a member renews while in `frozen` status, the end date is extended while preserving `status: 'frozen'` and `statusBeforeFreeze`. Scheduled cancellations record `cancelEffectiveDate` while keeping the membership usable (`status: 'active'`) until the effective date. Optimistic concurrency locking is enforced across state mutations (`WHERE version = expectedVersion`).

---

## 🔐 4. Authentication & User Identity Lifecycle

### How Users Are Authenticated

```
                        1. POST /v1/auth/sign-in/email
                           (or /v1/auth/sign-up/email)
                                    │
                                    ▼
                          [ Better Auth Engine ]
                       Verifies password hash in DB
                                    │
                                    ▼
                       Creates row in `auth_session`
                   Sets HTTP-Only Cookie: `better-auth.session_token`
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
      Browser / Web Client                       REST / Postman Client
   Sends Cookie automatically             Sends Cookie or Bearer <token>
```

### Identity Resolution in NestJS (`AuthGuard`)

- Every protected route executes `AuthGuard`.
- `AuthGuard` extracts headers via `fromNodeHeaders(req.headers)` and calls `auth.api.getSession()`.
- Better Auth verifies the session against `auth_session` and resolves the user identity.
- If valid, attaches `req.user = session.user` and `req.session = session.session`. If invalid/missing, returns `401 Unauthorized` (`UNAUTHENTICATED`).
- **Session & Token Support:** Supports both HTTP-only session cookies and `Authorization: Bearer <session_token>` headers.
- **CSRF & Origin Configuration:**
  - `trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173']`.
  - `advanced: { disableCSRFCheck: false }`: We are not using `disableCSRFCheck`. Standard CSRF validation is enforced to safeguard cookie sessions. Workaround for Postman/curl is to provide an allowed `Origin` header or `Authorization: Bearer <token>`.

### Email Verification, Password Reset & Transactional Email Provider
- **Provider Strategy (`EmailService`):** Dedicated transactional email service supporting Resend, AWS SES, Postmark, and SMTP via `EMAIL_PROVIDER` and provider API keys (with deterministic logging mock for local/test runs).
- **Email Verification (`POST /v1/auth/verify-email`):** Sends secure cryptographic verification tokens to confirm user identity before granting sensitive operations.
- **Password Reset (`POST /v1/auth/forgot-password`, `POST /v1/auth/reset-password`):** Generates time-bounded (1 hour) reset tokens delivered via `EmailService`.
- **Platform Lifecycle Emails:** Dispatches official gym approval (`sendGymApprovedEmail`) and rejection notices with mandatory reason codes (`sendGymRejectedEmail`) to gym owners upon platform audit decisions.

---

## 👥 5. Platform Admin vs. Gym Admin: Dual-Hierarchy Model

Every person in the system begins as a generic identity in `auth_user`. Privileges are granted solely through relational linkage:

```
                               ┌───────────────────────────┐
                               │  auth_user (Better Auth)  │
                               │  id, email, name          │
                               └─────────────┬─────────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼                                             ▼
       ┌─────────────────────────────┐               ┌─────────────────────────────┐
       │       platform_admins       │               │      staff_assignments      │
       ├─────────────────────────────┤               ├─────────────────────────────┤
       │ id (uuid)                   │               │ id (uuid)                   │
       │ user_id (FK -> auth_user)   │               │ user_id (FK -> users)       │
       │ role (3 roles):             │               │ gym_id (FK -> gyms)         │
       │   - superadmin              │               │ role (3 roles):             │
       │   - support                 │               │   - owner                   │
       │   - auditor                 │               │   - manager                 │
       │ is_active (boolean)         │               │   - front_desk              │
       │ Scope: Global (No gym_id)   │               │ branch_scope: all | selected│
       │ Guard: PlatformAdminGuard   │               │ Guard: TenantGuard          │
       │ Routes: /v1/platform/*      │               │ Routes: /v1/gyms/*, etc.    │
       └─────────────────────────────┘               └──────────────┬──────────────┘
                                                                    │ (if selected)
                                                                    ▼
                                                     ┌─────────────────────────────┐
                                                     │     staff_branch_access     │
                                                     │ staff_assignment_id, branch │
                                                     └─────────────────────────────┘
```

### Role Breakdown

- **Platform Admin Roles (`platform_admins`):**
  - **`superadmin`:** Full platform god-mode (verify/approve gym licenses, activate/suspend gyms, promote/revoke other platform admins).
  - **`support`:** Read-only gym and user inspection for technical support and troubleshooting.
  - **`auditor`:** Compliance and financial oversight; reads tamper-evident hash chains and platform metrics.
- **Gym Staff Roles (`staff_assignments`):**
  - **`owner`:** Full tenant ownership (provisions gym, assigns managers/front desk, configures payment providers, closes gym).
  - **`manager`:** Operational management (creates branches, configures plans, overrides variance thresholds, reviews freezes).
  - **`front_desk`:** Day-to-day reception (opens/closes cashier shifts, handles member check-ins, processes desk sales).

---

## 🗄️ 6. Core Database Schemas Implemented

- **Gyms Table (`gyms`):**
  - `id`: uuid (PK, default gen_random_uuid())
  - `legalName`: text (e.g. "Al Quoz Fitness LLC")
  - `tradeName`: text (e.g. "GymPulse Al Quoz")
  - `tradeLicenseNumber`: text (UAE Trade License / Indian Registration)
  - `vatRegistered`: boolean (default false)
  - `trnNumber`: text (unique, exactly 15 digits if vatRegistered in UAE)
  - `timezone`: text (default 'Asia/Dubai')
  - `currency`: char(3) (default 'AED', supports 'SAR', 'INR')
  - `status`: 'pending_verification' | 'active' | 'suspended' | 'closed' | 'rejected'
  - `settings`: jsonb (default {})
  - `createdAt`, `updatedAt`: timestamptz

- **Users Table (`users` - Domain Identity):**
  - `id`: uuid (PK, default gen_random_uuid())
  - `authUserId`: text (FK -> auth_user.id, nullable, unique)
  - `fullName`: text
  - `email`: text (nullable)
  - `phone`: text (nullable, unique when not null)
  - `nameSearch`: text (normalized lowercase for search)
  - `status`: 'active' | 'disabled'
  - `createdAt`: timestamptz

- **Gym Documents Table (`gym_documents`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: cascade)
  - `docType`: 'trade_license' | 'owner_id' | 'tax_certificate' | 'other'
  - `fileName`: text
  - `storageKey`: text
  - `mimeType`: text
  - `sizeBytes`: integer
  - `uploadedBy`: uuid (FK -> users.id)
  - `createdAt`: timestamptz

- **Branches Table (`branches`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict)
  - `name`: text (e.g. "Main Branch", "Downtown Branch")
  - `address`: jsonb ({ street, city, emirate, country, postalCode })
  - `isActive`: boolean (default true)
  - `createdAt`: timestamptz

- **Staff Assignments Table (`staff_assignments`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict)
  - `userId`: uuid (FK -> users.id, onDelete: restrict)
  - `role`: 'owner' | 'manager' | 'front_desk'
  - `branchScope`: 'all' | 'selected' (default 'all')
  - `isActive`: boolean (default true)
  - `createdAt`: timestamptz
  - Unique Constraint: `(gymId, userId)`

- **Staff Branch Access Table (`staff_branch_access`):**
  - `gymId`: uuid (FK -> gyms.id, onDelete: cascade)
  - `staffAssignmentId`: uuid (FK -> staff_assignments.id, onDelete: cascade)
  - `branchId`: uuid (FK -> branches.id, onDelete: cascade)
  - Composite PK: `(staffAssignmentId, branchId)`

- **Members Table (`members`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict)
  - `userId`: uuid (FK -> users.id, onDelete: restrict)
  - `homeBranchId`: uuid (FK -> branches.id, onDelete: restrict)
  - `memberNumber`: text (auto-sequenced per gym: MEM-0001, MEM-0002)
  - `gender`: 'male' | 'female' | 'other'
  - `dateOfBirth`: date (YYYY-MM-DD)
  - `emergencyContact`: jsonb ({ name, relation, phone })
  - `status`: 'active' | 'inactive' | 'suspended' | 'cancelled'
  - `createdAt`, `updatedAt`: timestamptz
  - Unique Constraint: `(gymId, memberNumber)`

- **Plans Table (`plans`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict)
  - `title`: text (e.g. "1-Month Unlimited")
  - `description`: text
  - `durationValue`: integer (e.g. 1)
  - `durationUnit`: 'days' | 'months' | 'years'
  - `priceMinor`: integer (e.g. 52500 fils = 525.00 AED)
  - `currency`: char(3) (default 'AED')
  - `vatRateBps`: integer (default 500 = 5.00%)
  - `isPriceTaxInclusive`: boolean (default true)
  - `branchAccess`: 'all_branches' | 'home_only'
  - `graceDays`: integer (default 0)
  - `isActive`: boolean (default true)
  - `createdAt`, `updatedAt`: timestamptz

- **Plan Freeze Policies Table (`plan_freeze_policies`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict)
  - `planId`: uuid (FK -> plans.id, onDelete: cascade)
  - `maxFreezes`: integer (default 1)
  - `maxDaysPerFreeze`: integer (default 14)
  - `maxTotalDays`: integer (default 30)
  - `feeMinor`: integer (default 0)
  - `currency`: char(3) (default 'AED')
  - `coolingPeriodDays`: integer (default 30)
  - `medicalProofRequired`: boolean (default false)
  - `adminApprovalRequired`: boolean (default false)
  - `createdAt`: timestamptz

- **Memberships Table (`memberships`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict)
  - `memberId`: uuid (FK -> members.id, onDelete: restrict)
  - `planId`: uuid (FK -> plans.id, onDelete: restrict)
  - `branchId`: uuid (FK -> branches.id, onDelete: restrict)
  - `status`: 'pending' | 'active' | 'frozen' | 'expired' | 'cancelled'
  - `startDate`: date (inclusive YYYY-MM-DD)
  - `endDate`: date (inclusive YYYY-MM-DD: startDate + duration - 1 day)
  - `autoRenew`: boolean (default false)
  - `createdAt`, `updatedAt`: timestamptz

- **Membership Term Adjustments Table (`membership_term_adjustments`):**
  - `id`: uuid (PK)
  - `membershipId`: uuid (FK -> memberships.id, onDelete: cascade)
  - `previousEndDate`: date
  - `newEndDate`: date
  - `reason`: text (mandatory audit justification)
  - `createdBy`: uuid (FK -> users.id)
  - `createdAt`: timestamptz

- **Shifts Table (`shifts`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict)
  - `branchId`: uuid (FK -> branches.id, onDelete: restrict)
  - `openedBy`: uuid (FK -> users.id)
  - `closedBy`: uuid (FK -> users.id, nullable)
  - `openingFloatMinor`: integer (e.g. 20000 fils = 200.00 AED)
  - `currency`: char(3) (default 'AED')
  - `countedCashMinor`: integer (nullable until close)
  - `expectedCashMinor`: integer (nullable until close: float + cashSales)
  - `varianceMinor`: integer (nullable until close: counted - expected)
  - `openedAt`: timestamptz (default now())
  - `closedAt`: timestamptz (nullable)
  - `notes`: text

- **Payments Table (`payments`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict)
  - `branchId`: uuid (FK -> branches.id, onDelete: restrict)
  - `memberId`: uuid (FK -> members.id, onDelete: restrict)
  - `shiftId`: uuid (FK -> shifts.id, onDelete: set null)
  - `amountMinor`: integer (total paid in fils)
  - `currency`: char(3) (default 'AED')
  - `method`: 'cash' | 'card_present' | 'tap' | 'razorpay' | 'stripe'
  - `status`: 'succeeded' | 'pending' | 'failed' | 'refunded'
  - `purpose`: 'membership' | 'personal_training' | 'merchandise'
  - `createdAt`: timestamptz (default now())

- **Invoices Table (`invoices`):**
  - `id`: uuid (PK)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict)
  - `branchId`: uuid (FK -> branches.id, onDelete: restrict)
  - `memberId`: uuid (FK -> members.id, onDelete: restrict)
  - `paymentId`: uuid (FK -> payments.id, onDelete: restrict)
  - `invoiceNumber`: text (gapless sequential: INV-000001, INV-000002)
  - `totalMinor`: integer (e.g. 52500)
  - `baseMinor`: integer (e.g. 50000 = total / 1.05 round-half-up)
  - `vatMinor`: integer (e.g. 2500 = 5% UAE VAT)
  - `vatRateBps`: integer (500 = 5.00%)
  - `currency`: char(3) (default 'AED')
  - `trnNumber`: text (seller TRN)
  - `createdAt`: timestamptz (default now())
  - Unique Constraint: `(gymId, invoiceNumber)`

- **Audit Logs Table (`audit_logs`):**
  - `id`: bigserial (PK, auto-increment)
  - `gymId`: uuid (FK -> gyms.id, onDelete: restrict, nullable for platform events)
  - `actorUserId`: text (Better Auth user ID)
  - `actorRole`: text (e.g. 'owner', 'manager', 'front_desk')
  - `adminActorId`: uuid (FK -> platform_admins.id, onDelete: set null)
  - `action`: text (e.g. 'gym.create', 'shift.open', 'payment.desk_sale')
  - `entityType`: text (e.g. 'gym', 'shift', 'payment', 'membership')
  - `entityId`: text
  - `reasonCode`: text (nullable)
  - `payload`: jsonb (default {})
  - `ip`: text
  - `device`: text
  - `prevHash`: text (SHA-256 hash of previous row; 64 zeros for genesis)
  - `rowHash`: text (SHA-256 hash of prevHash + canonical JSON payload)
  - `createdAt`: timestamptz (default now())

---

## 🛡️ 7. Audit Trail & Tenant Scoping Enforcement System

### A. Cryptographic Audit Chain (`AuditService`)

- **Formula:** `rowHash = SHA-256(prevHash + canonicalJSON(row))`
- **Genesis Block:** The first row in the ledger uses a 64-character zero string:
  `0000000000000000000000000000000000000000000000000000000000000000`
- **Canonical Stringification (`canonicalStringify`):**
  - PostgreSQL `jsonb` stores keys in its own internal binary ordering (sorted by key length, then alphabetically). Calling standard `JSON.stringify` on in-memory objects vs database-queried JSONB produces differing key orders and false tamper alerts.
  - `AuditService` enforces recursive alphabetical key-sorting across all nesting depths at both log insertion and verification time.
- **Tamper Detection:** `verifyChainIntegrity(limit)` verifies:
  1. Continuity: `current.prevHash === previous.rowHash` across contiguous chronological rows.
  2. Recalculation: `sha256(expectedPrevHash + canonicalPayload) === current.rowHash`.
     Flags the exact row ID on mismatch or broken link.

### B. Tenant Scoping Helpers (`tenant-scope.helper.ts`)

- **`scopeToGym(table, gymId, extraCondition?)`:** Enforces `table.gym_id = :gymId`. Use for list/filter queries.
- **`scopeEntityToGym(table, gymId, entityId, extraCondition?)`:** Enforces composite condition `table.gym_id = :gymId AND table.id = :entityId`. _Rule: Never fetch, update, or delete a tenant-scoped resource by entity ID alone._
- **`assertTenantOwnership(entity, expectedGymId, resourceName?)`:** Throws `403 Forbidden` (`TENANT_MISMATCH`) if the resource's `gymId` does not match the active session.

---

## 💳 8. Linked Accounts & Platform Secrets Payment Architecture

GymPulse follows the marketplace & linked-accounts pattern (e.g. Razorpay Route, Tap Marketplace, Stripe Connect):

- **Platform Master Keys in Secrets Manager:** The platform's master keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `TAP_SECRET_KEY`, `STRIPE_SECRET_KEY`) reside exclusively in server-level environment variables / secrets manager via `PlatformSecretsService`.
- **Tenant-Scoped Accounts in `gym_payment_accounts`:** Each gym stores only its provider account identifiers:
  - **Razorpay Route:** Linked Account ID (`accountId` / `provider_account_id`).
  - **Tap Payments (GCC):** Merchant Account ID (`merchantId` / `provider_account_id`).
  - **Stripe Connect:** Connected Account ID (`accountId` / `provider_account_id`).
- **No JSON Secrets in `gyms`:** The legacy `payment_provider_config` JSON column was completely deleted from `gyms`.
- **Interim AES-256-GCM Encryption:** If interim custom credentials are submitted:
  - Encrypted with AES-256-GCM (random 96-bit IV, 128-bit auth tag) in `gym_payment_accounts.encrypted_secrets`.
  - Allowed only for the Gym Owner (`@Roles('owner')`).
  - NEVER returned in API responses (omitted on `GET /v1/gyms/payment-config` and `GET /v1/gyms/payment-accounts`).
  - Changes logged to tamper-evident audit trail without including plaintext secrets.

---

## 📡 9. Complete Implemented Endpoints Matrix

### System Endpoints

- `GET /v1/meta` — Public — API name, version, timezone, default currency.
- `GET /v1/health` — Public — Neon DB connection health check (`SELECT 1`).

### Authentication Endpoints (`/v1/auth/*`)

- `POST /v1/auth/sign-up/email` — Public — Registers identity in `auth_user`.
- `POST /v1/auth/sign-in/email` — Public — Validates credentials, issues session token.
- `GET /v1/auth/get-session` — Public — Inspect current session and user payload.

### Tenancy & Staff Endpoints (`/v1/gyms/*`)

- `POST /v1/gyms` — `AuthGuard` — Provisions new gym + default branch + assigns caller as Owner (enforces strictly **1 gym per user** max via `GYM_CREATION_LIMIT_EXCEEDED`).
- `PATCH /v1/gyms/profile` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner', 'manager')` — Updates gym profile info (allowed while `pending_verification`).
- `POST /v1/gyms/documents` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner', 'manager')` — Uploads verification documents (trade license, owner ID) while pending.
- `GET /v1/gyms/documents` — `AuthGuard`, `TenantGuard` — Lists uploaded verification documents.
- `GET /v1/gyms/my-gyms` — `AuthGuard` — Lists only the gyms where caller has an active staff role.
- `GET /v1/gyms/current` — `AuthGuard`, `TenantGuard` — Returns current gym profile and branches for `x-gym-id`.
- `GET /v1/gyms/staff` — `AuthGuard`, `TenantGuard` — Lists all active staff for the gym.
- `POST /v1/gyms/staff` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner')` — Assigns or updates staff role and branch access.
- `GET /v1/gyms/payment-config` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner', 'manager')` — Returns dynamic payment config (Tap/Razorpay, secrets masked).
- `POST /v1/gyms/payment-config` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner')` — Updates dynamic payment provider credentials & defaults.
- `GET /v1/gyms/payment-account` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner')` — Returns provider account id, status, charges/payouts enabled (secrets omitted).
- `PUT /v1/gyms/payment-account` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner')` — Configures provider account id and status for gym.
- `GET /v1/gyms/audit-logs` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner', 'manager')` — Returns tenant-scoped tamper-evident audit logs.
- `POST /v1/gyms/audit-logs/verify` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner')` — Cryptographically verifies SHA-256 audit chain integrity.

### Branch Management Endpoints (`/v1/branches/*`)

- `GET /v1/branches` — `AuthGuard`, `TenantGuard` — Lists all branches for `x-gym-id`.
- `POST /v1/branches` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner', 'manager')`, `ActiveGymGuard` — Creates new branch (blocked with `403 Forbidden` (`GYM_NOT_ACTIVE`) if gym status is not `active`).
- `GET /v1/branches/:id` — `AuthGuard`, `TenantGuard` — Gets specific branch details (strictly scoped by gymId).

### Members Module Endpoints (`/v1/members/*`)

- `POST /v1/members` — `AuthGuard`, `TenantGuard`, `RolesGuard`, `ActiveGymGuard` — Registers member, allocates sequential `MEM-0001` (blocked if gym not active). Desk registrations create a `users` row with `auth_user_id: null` (no login account created).
- `GET /v1/members` — `AuthGuard`, `TenantGuard` — Paginated member list with name/phone/memberNumber search.
- `GET /v1/members/:id` — `AuthGuard`, `TenantGuard` — Member profile with active memberships and term history.
- `PATCH /v1/members/:id` — `AuthGuard`, `TenantGuard`, `RolesGuard` — Updates member demographics and emergency contacts.

### Plans Module Endpoints (`/v1/plans/*`)

- `POST /v1/plans` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner', 'manager')`, `ActiveGymGuard` — Creates membership plan with price, duration, and VAT config (blocked if gym not active).
- `GET /v1/plans` — `AuthGuard`, `TenantGuard` — Lists active membership plans for desk sale.
- `POST /v1/plans/:id/freeze-policy` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner', 'manager')`, `ActiveGymGuard` — Configures max freezes, max days, and cooling period (blocked if gym not active).

### Memberships Module Endpoints (`/v1/memberships/*`)

- `POST /v1/memberships` — `AuthGuard`, `TenantGuard`, `RolesGuard`, `ActiveGymGuard` — Provisions prepaid membership with inclusive business date math (blocked if gym not active).
- `GET /v1/memberships/:id` — `AuthGuard`, `TenantGuard` — Retrieves membership term details and adjustments ledger.
- `POST /v1/memberships/:id/adjust-dates` — `AuthGuard`, `TenantGuard`, `RolesGuard('owner', 'manager')` — Extends/adjusts inclusive end date with mandatory audit reason code.

### Cashier Shifts Endpoints (`/v1/shifts/*`)

- `POST /v1/shifts/open` — `AuthGuard`, `TenantGuard`, `RolesGuard` — Opens cashier shift with opening float (in minor units).
- `GET /v1/shifts/current` — `AuthGuard`, `TenantGuard` — Resolves currently active shift for authenticated user.
- `POST /v1/shifts/:id/close` — `AuthGuard`, `TenantGuard`, `RolesGuard` — Blind shift closeout; computes expected cash and variance in fils.

### Payments & Invoicing Endpoints (`/v1/payments/*`)

- `POST /v1/payments/desk-sale` — `AuthGuard`, `TenantGuard`, `RolesGuard`, `ActiveGymGuard` — Atomic front desk sale: payment, membership, sequential invoice (blocked if gym not active).
- `GET /v1/payments/invoices/:id` — `AuthGuard`, `TenantGuard` — Retrieves gapless tax invoice with 5% UAE VAT integer fils breakdown.

### Platform Administration Endpoints (`/v1/platform/*`)
Guarded by `AuthGuard`, `PlatformAdminGuard`, and `PlatformRolesGuard`:

- `GET /v1/platform/overview` — `@PlatformRoles('superadmin', 'support', 'auditor')` — Global platform KPIs (gyms, branches, members, admins).
- `GET /v1/platform/audit-logs` — `@PlatformRoles('superadmin', 'support', 'auditor')` — Platform-wide audit history & hash chain verification.
- `GET /v1/platform/review-queue` — `@PlatformRoles('superadmin')` — Review queue of gyms pending verification with owners and documents.
- `GET /v1/platform/gyms` — `@PlatformRoles('superadmin')` — Lists all tenant gyms with status/search filter.
- `GET /v1/platform/gyms/:id` — `@PlatformRoles('superadmin')` — Returns gym details and summary counts (`totalBranches`, `totalStaff`, `totalMembers`), never member lists.
- `POST /v1/platform/gyms/:id/approve` — `@PlatformRoles('superadmin')` — Approve gym verification, activate account, and notify owner via email.
- `POST /v1/platform/gyms/:id/reject` — `@PlatformRoles('superadmin')` — Reject gym verification with mandatory reason and notify owner via email.
- `POST /v1/platform/gyms/:id/suspend` — `@PlatformRoles('superadmin')` — Suspend gym operations with mandatory reason and notify owner via email.
- `POST /v1/platform/gyms/:id/reactivate` — `@PlatformRoles('superadmin')` — Reactivate suspended gym with mandatory reason and notify owner via email.
- `GET /v1/platform/admins` — `@PlatformRoles('superadmin')` — Lists all platform administrators.
- `POST /v1/platform/admins` — `@PlatformRoles('superadmin')` — Promotes a user to platform administrator (mandatory reason required, audited).
- `PATCH /v1/platform/admins/:id/status` — `@PlatformRoles('superadmin')` — Activate / deactivate a platform administrator (audited).

---

## 🧪 10. Verified End-to-End Test Suite (19 Stages)

The complete multi-tenant platform architecture is validated against a 19-stage automated integration test suite (`apps/api/test-e2e-flow.cjs`) running against real Neon PostgreSQL:

- **Step 0: DB Schema & Ledger Reset (Status: ✅ PASSED)**
  - Verifies PostgreSQL `btree_gist` extension and establishes `no_overlapping_freezes` exclusion constraint on startup.
  - Drops deprecated `payment_provider_config` column and auto-migrates missing columns (`metadata`, `currency`, `encrypted_secrets`).
  - Resets `audit_logs` table identity for a pristine genesis block (`000...000`).

- **Step 1: Health & Meta Inspection (Status: ✅ PASSED)**
  - `/v1/health` returns status `ok` via active Neon pool connection.
  - `/v1/meta` returns `gympulse-api (0.0.1)` with default timezone and currency.

- **Step 2: User Registration & Auth (Status: ✅ PASSED)**
  - Registers a new unique gym owner via `/v1/auth/sign-up/email`.
  - Authenticates via `/v1/auth/sign-in/email` and extracts session Bearer token.

- **Step 3: Gym Onboarding & Scoping (Status: ✅ PASSED)**
  - Calls `POST /v1/gyms` to provision tenant record with status `pending_verification`.
  - Auto-provisions default branch and assigns caller as `owner` in `staff_assignments`.

- **Step 4: Active Gym Guard, Verification Gate & Platform Review Queue (Status: ✅ PASSED)**
  - Asserts unverified gym (`pending_verification`) is blocked by `ActiveGymGuard` from creating branches, members, and plans (`403 Forbidden` / `GYM_NOT_ACTIVE`).
  - Asserts profile editing (`PATCH /v1/gyms/profile`) and document uploads (`POST /v1/gyms/documents`) succeed while `pending_verification`.
  - Verifies platform admin inspects pending gyms and uploaded documents via `GET /v1/platform/review-queue`.
  - Executes platform approval (`POST /v1/platform/gyms/:id/approve`), activating the gym and sending an approval email to the owner.
  - Verifies branches, members, and plans can now be created successfully once active.

- **Step 5: Linked Accounts & Platform Secrets Architecture (Status: ✅ PASSED)**
  - Stores provider account IDs in `gym_payment_accounts` (Tap merchant ID + Razorpay Route linked account ID).
  - Confirms `payment_provider_config` column is deleted from `gyms`.
  - Verifies interim secrets are AES-256-GCM encrypted at rest in DB and NEVER returned via API.
  - Verifies audit logs record account updates without plain secrets.

- **Step 6: Members Module & Sequencing (Status: ✅ PASSED)**
  - Registers Member 1 (`MEM-0001`) and Member 2 (`MEM-0002`) with auto-sequenced codes.
  - Executes trigram-compatible member search by name.

- **Step 7: Plans & Freeze Policies (Status: ✅ PASSED)**
  - Creates 1-Month Plan (525.00 AED tax inclusive).
  - Provisions freeze policy (max 2 freezes, 14 days max total, 7 days minimum, 30 days cooling period).

- **Step 8: Memberships & Date Math (Status: ✅ PASSED)**
  - Provisions prepaid membership with inclusive term math: `2026-11-01` to `2026-11-30` = exactly 30 days inclusive.
  - Adjusts term (+5 days) updating end date to `2026-12-05` with audit record.

- **Step 9: Cashier Shift Management (Status: ✅ PASSED)**
  - Opens cashier shift at Branch 1 with 200.00 AED float (`openingFloatMinor: 20000`).
  - Resolves active shift via `/v1/shifts/current`.

- **Step 10: Desk Sale & Sequential Invoices (Status: ✅ PASSED)**
  - Executes front desk sale: processes 525.00 AED cash.
  - Calculates 5% UAE VAT round-half-up (500.00 AED base + 25.00 AED VAT).
  - Generates gapless invoice `INV-000001`.

- **Step 11: Shift Closeout & Reconciliation (Status: ✅ PASSED)**
  - Closes cashier shift; submits 725.00 AED counted cash (`72500` fils).
  - Server verifies `expectedCashMinor: 72500` (float + sales) and reports `varianceMinor: 0` (balanced).

- **Step 12: Interim Cryptographic Audit Trail (Status: ✅ PASSED)**
  - Executes `POST /v1/gyms/audit-logs/verify`.
  - Traverses all chained audit records using `canonicalStringify`.
  - Verifies 100% hash chain validity and zero tampering across core commerce events.

- **Step 13: 10-Step Freeze Eligibility Check & Quota Calculator (Status: ✅ PASSED)**
  - Evaluates all 10 eligibility rules (`GET /v1/memberships/:id/freeze-eligibility`).
  - Verifies quota counting across `cycle_basis: 'anniversary_year'` and `'membership_term'`, remaining days (`14`), and remaining occurrences (`2`).

- **Step 14: Inclusive Date Math Preview (Status: ✅ PASSED)**
  - Computes preview ($N = E - S + 1 = 7$ days), min early return charge ($7$ days), fee (`5000` fils), and projected end date via `POST /v1/memberships/:id/freezes/preview`.

- **Step 15: Freeze Scheduling, Database Constraints & Concurrency (Status: ✅ PASSED)**
  - Submits scheduled freeze request transitioning to `scheduled`.
  - Tests database exclusion constraint: overlapping freeze rejected with `FREEZE_OVERLAP`.
  - Tests adjacency protection: back-to-back freeze starting on `end_date + 1` rejected with `FREEZE_OVERLAP`.
  - Tests strict no-backdating: past start date rejected with `FREEZE_START_IN_PAST`.
  - Cancels scheduled freeze and verifies full quota restoration (`14` days, `2` occurrences).
  - Executes parallel submission race test via `Promise.all`: PostgreSQL exclusion constraint deterministically accepts exactly one and rejects the other with `FREEZE_OVERLAP`.

- **Step 16: Active Freeze, State Transition & Desk Early Lift (Status: ✅ PASSED)**
  - Provisions active membership starting today and submits freeze starting today; transitions status immediately to `frozen`.
  - Front desk lifts freeze early with Manager PIN step-up; server enforces `lifted_on = today`.
  - Charges policy minimum 7 days, returns 3 unused days to quota, updates freeze to `early_lifted`, and restores membership to `active` with `membership_adjustments` (`kind: 'freeze_early_lift'`).
  - Asserts double-lift attempt is safely rejected (`FREEZE_NOT_ACTIVE` or `FREEZE_ALREADY_LIFTED`).

- **Step 16b: Daily Batch Settlement Job, Live Freeze Safeguard & Proof Purge (Status: ✅ PASSED)**
  - Schedules freeze for future date; runs daily batch job (`POST /v1/freezes/settle-due`) activating the freeze.
  - Asserts member archiving (`POST /v1/members/:id/archive`) is blocked while live freeze is active (`LIVE_FREEZE_ACTIVE`).
  - Purges expired supporting proofs (`POST /v1/freezes/purge-proofs`) adhering to 30-day retention schedule.
  - Runs settlement job as of date past end date; automatically completes freeze, charges full duration, restores membership to `active`, and records ledger adjustment.

- **Step 17: Payment-Backed Membership Renewal (Status: ✅ PASSED)**
  - Executes renewal (`POST /v1/memberships/:id/renew`) tied to POS card payment and sequential tax invoice in a single atomic transaction.
  - Verifies `membership_adjustments` ledger links `payment_id` to prevent unearned free time.
  - Confirms frozen memberships preserve `status: 'frozen'` during renewal.

- **Step 18: Notice-Period Cancellation & Harmless Double Cancellation (Status: ✅ PASSED)**
  - Schedules notice-period cancellation (`POST /v1/memberships/:id/cancel` with `cancelEffectiveDate`); membership remains usable (`active`) during notice.
  - Blocks freeze requests during pending cancellation notice.
  - Verifies double cancellation is idempotent and harmless.
  - Executes immediate cancellation; membership transitions to `cancelled` and rejects subsequent renewal attempts.

- **Step 19: Final Cryptographic SHA-256 Audit Trail Verification (Status: ✅ PASSED)**
  - Executes `POST /v1/gyms/audit-logs/verify` across all operations.
  - 100% hash chain integrity verified across all stages with zero tampering.

---

## ⚙️ 11. Environment Variables & Operational Commands

### Environment Variables (`apps/api/.env`)

```ini
# Database Connection (Neon PostgreSQL with SSL)
DATABASE_URL="postgresql://neondb_owner:npg_...@ep-....eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Better Auth Configuration
BETTER_AUTH_SECRET="your-high-entropy-secret-key-at-least-32-chars"
BETTER_AUTH_URL="http://localhost:3000"

# Server Configuration
PORT=3000
NODE_ENV="development"
```

### Essential Operational Commands

- `pnpm dev:api` (Project Root): Starts the NestJS API in watch mode (`nest start --watch`).
- `pnpm dev:web` (Project Root): Starts the React + Vite frontend SPA (`vite`).
- `pnpm build` (Project Root): Compiles all workspace packages (`pnpm -r build`).
- `pnpm typecheck` (Project Root): Typechecks all packages (`pnpm -r typecheck`).
- `pnpm test` (Project Root): Executes the automated test suite (`pnpm --filter api test`).
- `pnpm --filter @gympulse/shared build` (Project Root): Compiles the shared package (Zod schemas, types, VAT & date utilities).
- `pnpm --filter api db:generate` (Project Root): Generates clean Drizzle SQL migration files from `src/db/schema.ts`.
- `pnpm --filter api db:migrate` (Project Root): Executes pending Drizzle SQL migrations against Neon PostgreSQL.
- `pnpm --filter api db:reset` (Project Root): Drops public schema and executes fresh Drizzle migrations (dev data is disposable).
- `node apps/api/seed-platform-admin.cjs <email>` (Project Root): Bootstraps or promotes a user to Platform Superadmin in Neon DB.

---

## ❓ 12. Open Decisions & Known Technical Risks

### Open Decisions (Spec Section 15.2 Tracking)

1. **Payment Gateway Credentials Vaulting (O-1 Update):**
   - _Status:_ Resolved. Platform master keys moved to secrets manager; `payment_provider_config` dropped from `gyms` table. Provider account IDs stored in `gym_payment_accounts`. Interim secrets encrypted with AES-256-GCM envelope encryption, restricted to gym owners, never returned in API responses, and changes audited without secrets.
2. **Peppol E-Invoicing Provider (O-3):**
   - _Status:_ Monitoring UAE FTA e-invoicing Phase 2 timeline. Schema already records all required e-invoice fields (`trn_number`, line items in fils, VAT breakdown).
3. **Transactional Communication Provider:**
   - _Status:_ Outbox table (`notification_outbox`) is defined. Evaluation between direct Meta WhatsApp Cloud API vs Twilio / Infobip will occur in Milestone 6.
4. **Medical Proof Storage Location (O-4 / O-11):**
   - _Status:_ S3-compatible bucket located strictly in UAE (AWS `me-central-1` or Azure UAE North) to satisfy UAE health-data residency rules. Retention set to auto-purge via `delete_after`.

### Known Technical Risks & Mitigations

1. **Cross-Tenant Query Leaks:**
   - _Mitigation:_ Enforced `scopeToGym` and `scopeEntityToGym` in all service methods. No tenant-scoped query is ever executed by entity ID alone.
2. **Audit Hash Chain Key Ordering:**
   - _Mitigation:_ Solved via recursive `canonicalStringify`. Guarantees deterministic serialization before hashing, eliminating false positives caused by PostgreSQL `jsonb` column key reordering.
3. **Audit Hash Chain Race Conditions:**
   - _Risk:_ Concurrent high-volume audit writes could fork the hash chain if transactions read `prevHash` simultaneously.
   - _Mitigation:_ Serial transaction isolation or advisory locks on audit write paths during heavy concurrent traffic.
4. **Serverless Neon Cold Starts:**
   - _Mitigation:_ Pooled connection string enabled; health check pings keep instances warm during operating hours.

---

## 🎯 13. Roadmap & Next Steps

```
[ Milestone 1: Foundation ] ──► [ Milestone 2: Core Commerce ] ──► [ Milestone 5: Retention & Freeze Engine ] ──► [ Milestone 3: Access & Check-In ]
         ✅ COMPLETE                     ✅ COMPLETE                         ✅ COMPLETE                                  🚀 UP NEXT
- Neon DB Schema & Migrations       - Members Module (Auto-Seq)         - PostgreSQL GIST Exclusion Constraint      - Ed25519 Rotating Pass Tokens
- Better Auth Integration           - Plans & Freeze Policies           - 10 Eligibility Checks & Quota Math        - Software Desk Barcode/QR Scanner
- TenantGuard & RolesGuard          - Inclusive Term Math & Ledger      - Date Math Preview (N = E - S + 1)         - Lazy Scan Freeze Settlement
- Platform Superadmin Hierarchy     - Cashier Shifts & Blind Rec        - Desk Early Lift (Manager PIN Step-up)     - Fast Search & Ctrl+K Desk Access
- ActiveGymGuard & 1-Gym Cap        - Desk Payments & 5% UAE VAT        - 30-Day Proof Retention & Purge Job        - Manual Override with Reason
- SHA-256 Audit Trail & Scoping     - Gapless Sequential Invoices       - Payment-Backed Renewals & Cancellations   - Shift & Visit Capacity Reports
```

### Delivered Milestone 5 Architecture & Endpoints:

1. **The Full Freeze Engine (`apps/api/src/freezes/`):**
   - **PostgreSQL GIST Exclusion Constraint (`no_overlapping_freezes`):** Enforces Rule 9 at the database kernel level using `btree_gist`: `EXCLUDE USING gist (membership_id WITH =, daterange(start_date, (end_date + integer '1'), '[]') WITH &&) WHERE (status IN ('pending', 'scheduled', 'active'))`. Prevents direct overlaps and back-to-back freezes concurrently; maps `23P01`/`23505` to `ConflictException('FREEZE_OVERLAP')`.
   - **10-Step Eligibility Check (`GET /v1/memberships/:id/freeze-eligibility`):** Evaluates all 10 eligibility rules (policy enabled, membership status, balance check, notice period, minimum duration, remaining days quota, occurrence limit, term bounds, non-adjacent overlap check, proof requirement).
   - **Quota Counting Engine:** Evaluates `cycle_basis: 'anniversary_year'` vs `'membership_term'`. Accurately counts days charged for `completed` and `early_lifted`, and requested days for `pending`, `scheduled`, and `active`. Excludes `cancelled` and `rejected` from both days and occurrences.
   - **Strict No-Backdating & Role-Gated Waivers:** Start dates in the past are unconditionally rejected (`FREEZE_START_IN_PAST`). Notice waivers are strictly restricted to `owner` and `manager` roles with audit trail recording.
   - **Segregation of Duties & Anti-Staleness:** Re-evaluates all eligibility checks upon approval. Rejects stale approvals where start date has elapsed (`APPROVAL_STALE`). Strictly prohibits self-approval of freeze requests (`SELF_APPROVAL_PROHIBITED`).
   - **Inclusive Date Math Preview (`POST /v1/memberships/:id/freezes/preview`):** Computes $N = E - S + 1$, minimum early return charge $\min(N, min\_days)$, projected new end date, and fee in minor units.
   - **Idempotent Freeze Submission (`POST /v1/memberships/:id/freezes`):** Snapshots policy terms; transitions membership status to `frozen` immediately if $start\_date \le today$, else `scheduled` or `pending_review`.
   - **Desk Early Lift with Step-up PIN (`POST /v1/freezes/:id/lift`):** Manager/Owner or Front Desk with manager PIN step-up; server enforces `lifted_on = today`. Calculates $days\_charged = \min(N, \max(days\_used, min\_days))$, restores membership to `active`, updates end date via `membership_adjustments` (`kind: 'freeze_early_lift'`), and returns unused days to quota. Protected against double-lifting via `adjustment_once_per_freeze` unique index and status check. PIN is never logged.
   - **Supporting Proof Storage & 30-Day Purge (`POST /v1/freezes/:id/proofs`, `POST /v1/freezes/purge-proofs`):** Restricted to `owner` and `manager`. Automatically schedules auto-purge (`delete_after: today + 30`) and purges expired proofs with audit logging.
   - **Batch Daily Settlement & Lazy Scan Settlement (`POST /v1/freezes/settle-due`, `settleDueFreezesForMembership`):** Automatically activates due freezes, completes ended freezes (restoring membership and adding freeze ledger extension), and expires stale pending requests.
   - **Live Freeze Safeguard on Member Archiving:** Blocks `POST /v1/members/:id/archive` with `LIVE_FREEZE_ACTIVE` if an active freeze is live.

2. **Membership Renewals & Cancellation (`apps/api/src/memberships/`):**
   - **Payment-Backed Renewal (`POST /v1/memberships/:id/renew`):** Atomic desk sale transaction generating payment record, sequential tax invoice, and `membership_adjustments` row linking `payment_id` (preventing unearned free time). Preserves `status: 'frozen'` if membership is currently frozen.
   - **Notice-Period & Immediate Cancellation (`POST /v1/memberships/:id/cancel`):** Supports scheduled cancellation with `cancelEffectiveDate` (membership stays active/usable until effective date) and immediate cancellation. Idempotent and harmless duplicate handling; blocks freeze requests during notice.
   - **Optimistic Concurrency Control:** Guards all membership mutations with `WHERE version = expectedVersion`, rejecting concurrent updates with `VERSION_CONFLICT`.

3. **Next Steps (Milestone 3: Access Control & Desk Check-In):**
   - **Ed25519 Dynamic Member Pass Tokens:** Generate time-limited (45-second TTL) cryptographically signed QR tokens (`POST /v1/me/pass-token`) with replay prevention.
   - **Software Desk Scanner Check-In (`POST /v1/access/verify`):** Scan verification via USB/Bluetooth HID scanner or webcam, integrating lazy scan freeze settlement (`settleDueFreezesForMembership`).
   - **Fast Member Search & Manual Check-In Override:** Fast Ctrl+K search (`GET /v1/members/search`) and manual check-in with mandatory audit reason (`POST /v1/access/manual`).
   - **Capacity Tracking & Daily Attendance Logs:** Active gym visit logging and branch capacity metrics.
