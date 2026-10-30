# GymPulse Hardening Guide: step by step with the coding agent

This guide turns the code review into 13 steps. Each step has a prompt you paste to the agent, checks you run yourself, and what to report back to me.

## How to use it

1. Work on a new git branch (`hardening`). Do one step at a time. Commit after each step. **Run them in this order: 0, 1, 2, 6, 7, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14.** The step numbers are labels, not the order: the month-end helper (6) and the audit rebuild (7) come first because the sale, renewal and void steps (3, 4, 5) depend on them.
2. Use a development database that holds no real data. Several steps reset it.
3. At the start of each agent session, paste the **Standing rules** below once. Then paste one step prompt.
4. When the agent finishes, run the "You check" list yourself. Paste the agent's final report to me and I will check it before you move on.
5. If the agent says something is unclear, answer it. Do not let it guess on money, security or dates.

## Standing rules (paste first, every session)

```text
STANDING RULES FOR THIS REPOSITORY
- Monorepo: apps/api (NestJS, Drizzle, Neon Postgres), packages/shared, apps/web.
- Schema changes go through Drizzle migrations only (db:generate; use drizzle-kit generate --custom for SQL Drizzle cannot express). Never put DDL (CREATE/ALTER/DROP) in application code, tests or scripts. Never hand-edit drizzle/meta/_journal.json.
- Development data is disposable: if a migration is awkward, reset the dev database and regenerate a clean migration set.
- Money is integer minor units (bigint in shared code). The server decides prices, currency, tax and dates. Never trust amounts, currency, shift ids, dates or roles sent by the client.
- Business dates are the gym's local calendar date (use getGymLocalDate / the gym timezone), never the UTC date.
- Never return, log, or write to the audit trail any secret, PIN, password or token.
- Every change ships with tests. Before reporting, run: pnpm build, pnpm typecheck and the test suite.
- Change only what the step asks. Do not refactor unrelated code. If something is unclear or conflicts with these rules, stop and ask.
- Final report format: (1) what changed, file by file; (2) new migrations; (3) new or changed endpoints; (4) tests added and their results; (5) anything you did not do and why.
```

---

## Step 0: Safety rails and script cleanup

**Why:** `reset-db.cjs` drops the whole schema unless `NODE_ENV=production`. If your `.env` points at a real database, it is wiped. The seed script also prints a default password.

```text
TASK: Make destructive scripts safe and remove clutter.

1. apps/api/reset-db.cjs: refuse to run unless ALL of these hold: ALLOW_DB_RESET=true is set; NODE_ENV is not "production"; the database name in DATABASE_URL matches the regex /(dev|test|local|scratch)/i. Before dropping anything, print the database host and name (never the password) and wait for the user to type the database name to confirm (skip the prompt only if CI=true).
2. Same guards for test-e2e-flow.cjs and any other script that truncates or resets data.
3. List every *.cjs and *.ts script in apps/api (seed, test-db, verify-schema, test-schema-guard, etc.). Delete duplicates and scripts that are no longer needed. Keep exactly one platform-admin seed script, in TypeScript, exposed as: pnpm --filter api seed:platform-admin. It reads PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD from the environment (no default password anywhere in the repo, README or script output) and refuses to run when NODE_ENV=production unless ALLOW_PROD_SEED=true.
4. Grep the whole repo for "AdminPassword123" and any other hardcoded credentials; remove them.
5. Add the new env vars to apps/api/.env.example with placeholder values only.

Report the list of deleted and kept scripts.
```

**You check:** try `pnpm --filter api db:reset` without `ALLOW_DB_RESET`. It must refuse.

---

## Step 1: Manager PIN

**Why:** the early-lift PIN is one gym-wide value in `gyms.settings.managerPin`, defaulting to `1234`, compared as plain text, with no lockout and no record of who approved.

```text
TASK: Replace the gym-wide manager PIN with per-manager hashed PINs.

Current problem: apps/api/src/freezes/freezes.service.ts reads (gym.settings as any).managerPin with a default of '1234' and compares with !==.

Implement:
1. New table manager_pins (created via a Drizzle migration): id uuid pk, gym_id (fk), user_id uuid (fk users, unique per gym), pin_hash text, failed_attempts int default 0, locked_until timestamptz null, created_at, updated_at.
2. Hash PINs with Node crypto scrypt (random 16-byte salt, store salt + hash in one string with parameters). Verify with crypto.timingSafeEqual.
3. Endpoints: PUT /v1/gyms/manager-pin (owner or manager sets their OWN PIN; 4 to 8 digits; reject trivial PINs such as 0000, 1234, 1111, repeated or sequential digits); no endpoint ever returns a PIN or hash.
4. Early lift by front_desk requires { approverUserId, managerPin }. The approver must be an active owner or manager of that gym (and have access to that branch). Verify the PIN against that approver only. 5 wrong attempts lock that PIN for 15 minutes (return 423 with code PIN_LOCKED). Wrong PIN returns code INVALID_MANAGER_PIN without revealing whether the approver exists.
5. If the approver has no PIN set, the lift is denied with code MANAGER_PIN_NOT_SET. There is NO default PIN.
6. Owner or manager lifting directly does not need a PIN.
7. Audit the lift with actor = the front-desk user and approvedBy = the approver user id. Never log the PIN.
8. Remove managerPin from gym settings everywhere (code, shared schemas, docs). Strip it from any existing gyms.settings JSON in a migration.
9. Rate-limit the lift endpoint (max 10 requests per minute per user).

Tests: PIN set and trivial PIN rejected; correct PIN lifts; wrong PIN increments attempts; lockout after 5; locked PIN rejected even when correct; no default PIN works; hash never appears in any response or audit payload; front desk cannot use another gym's manager as approver.
```

**You check:** try `1234` on a freeze lift. It must fail with `MANAGER_PIN_NOT_SET`.

---

## Step 2: Remove `asOfDate` and schedule the daily jobs

**Why:** any owner or manager can POST `asOfDate` to `settle-due` and complete freezes early. Nothing runs the job automatically.

```text
TASK: Make freeze settlement and proof purging internal scheduled jobs. No client-controlled dates.

Current problem: POST /v1/freezes/settle-due accepts asOfDate in the request body (freezes.controller.ts to freezes.service.ts settleDueFreezesForGym), and POST /v1/freezes/purge-proofs is also an HTTP endpoint. Nothing schedules them.

Implement:
1. Remove the asOfDate parameter from every HTTP path. Delete the HTTP endpoints settle-due and purge-proofs (or, if you need manual runs, expose them only to platform superadmin with no date parameter).
2. The service methods keep an optional clock argument (asOf: Date) used ONLY by tests and the scheduler internals.
3. Use @nestjs/schedule. Run hourly: for each gym whose local date has advanced since its last processed date, run settlement (activate due scheduled freezes, complete ended freezes with the extension ledger row, expire pending_review requests whose start date has passed). Record each (gym_id, local_date) run in a table gym_daily_runs (migration) so reruns are idempotent and missed hours catch up.
4. Prevent double runs across multiple instances with pg_try_advisory_lock; skip the run if the lock is held. Log errors per gym and continue with the next gym.
5. Daily proof purge: delete expired freeze_proofs rows AND call a StorageService.delete(storageKey) interface (create the interface and a local no-op implementation; real storage is a later step). Log counts, never file names or personal data.
6. Lazy settlement before check-in and before any freeze or membership read that depends on state stays as it is.
7. Audit every state change the job makes (system actor).

Tests (use the clock argument): a scheduled freeze becomes active when its local start date arrives; an ended freeze completes once, extends the end date once, and a second run changes nothing; a gym in Asia/Dubai at 23:30 UTC uses the next local date; two parallel runs complete each freeze exactly once; there is no HTTP route that accepts a date.
```

**You check:** search the repo for `asOfDate` in controllers. There must be none.

---

## Step 3: Atomic, server-priced membership sale

**Why:** `POST /v1/memberships` creates an `active` membership with no payment. Desk payments take `totalMinor`, `currency` and `shiftId` from the client. A payment with purpose `membership` can activate any membership, including cancelled ones.

```text
TASK: One atomic, server-priced sale for new memberships. Remove every way to get a membership without a payment.

Add endpoint POST /v1/sales/memberships (roles: owner, manager, front_desk; guards: AuthGuard, TenantGuard, ActiveGymGuard). Header Idempotency-Key is REQUIRED. Body (validate with a strict Zod schema in packages/shared; unknown fields rejected): { memberId, planId, branchId, startDate?, method: 'cash'|'card_pos'|'bank_transfer', discount?: { type: 'amount'|'percent', value, reasonCode, note } }.

Server behaviour, all in ONE database transaction:
1. Gym must be active and the subscription must allow payments (existing checkPaymentAllowed).
2. startDate must be >= gym-local today and <= today + 60 days; default today.
3. Price = plan.priceMinor from the database. The client never sends an amount or currency; currency = gym.currency.
4. Discount: only owner or manager may apply one; reasonCode required; percent 1 to 100; the result must be > 0 (a fully free membership is NOT a sale; it goes through the complimentary flow). Record the discount on the invoice lines and the audit entry.
5. Shift: for cash and card_pos, use the caller's OWN open shift at that branch; reject with SHIFT_NOT_OPEN if none. Ignore any shift id from the client. Branch on the payment = the shift's branch.
6. Compute base and VAT with the shared integer math (tax regime from the gym; non-VAT-registered gyms get tax 0).
7. Insert the membership with status 'pending', then the payment (status succeeded, recorded_by = caller, shift_id, idempotency_key, request_hash), then the invoice, then flip the membership to 'active', then the membership_adjustments row (kind 'purchase', payment_id set). Compute end date with the shared month-clamping helper (Step 6; if not done yet, use a TODO that fails tests).
8. Invoice: doc_type 'tax_invoice' if the gym is VAT registered, otherwise 'receipt'. issued_on = gym-local date. Store supplier, buyer and line snapshots (supplier legal name, tax number, address at issue time; plan title and period; discount line if any). Number from the locked counter row in the same transaction.
9. Audit entry written INSIDE the transaction (Step 7 provides the tx-aware logger; until then pass the tx handle).

Idempotency: add payments.idempotency_key and payments.request_hash with a unique index on (gym_id, idempotency_key) (migration). Same key and same request hash returns the original result with no new rows; same key with a different hash returns 409 IDEMPOTENCY_CONFLICT.

Remove or lock down:
- DELETE the staff route POST /v1/memberships (return 410 Gone, or remove it).
- POST /v1/payments/desk may no longer accept purposes 'membership' or 'renewal'. Allowed purposes: 'freeze_fee' (amount taken from the freeze's policy snapshot, not the client) and 'other' (owner or manager only, reason required, positive amount). Currency always = gym currency; shift rules as above.
- A payment can only activate a membership whose status is 'pending'. Never activate cancelled, expired or frozen memberships from a payment.

Tests: client-sent amount/currency/shiftId are rejected or ignored; zero and negative amounts rejected; front_desk cannot apply a discount; using another user's shift is impossible; same Idempotency-Key twice creates one sale; same key with a different body returns 409; 10 parallel sales give unique, gapless invoice numbers; non-VAT gym gets a receipt with no tax; invoice date uses the gym's local date (inject a clock at 23:30 UTC); cancelled membership cannot be activated; pending gym or suspended subscription is blocked; no code path creates an active membership without a payment row.
```

**You check:** create a membership through the API without a sale. It must be impossible.

---

## Step 4: One renewal path

**Why:** renewals exist in two places (`renewMembership` and a desk payment with purpose `renewal`), allow a client-chosen price, and skip the subscription and gym-status checks.

```text
TASK: Consolidate renewals into one server-priced, idempotent flow.

1. Add POST /v1/sales/renewals (same guards, Idempotency-Key, shift rules, discount rules and invoice behaviour as POST /v1/sales/memberships). Body: { membershipId, planId?, method, discount? }. Price comes from the plan in the database; the client never sends totalMinor.
2. Lock the membership row (SELECT ... FOR UPDATE) inside the transaction. Allowed statuses: active, frozen, expired. Reject cancelled memberships and memberships in a cancellation notice period (cancelEffectiveDate set).
3. Dates: if paid on or before end_date + grace_days, the new term starts the day after the current end_date; otherwise it starts on the gym-local payment date. If a freeze is scheduled or active, still extend by the plan duration (the freeze extension is added separately when the freeze completes). Use the shared month-clamping helper.
4. Write membership_adjustments (kind 'renewal', payment_id, previous_end_date, new_end_date) and the invoice in the same transaction.
5. Delete MembershipsService.renewMembership, the route POST /v1/memberships/:id/renew, and the 'renewal' purpose in the desk payment code. Update shared schemas and docs.

Tests: renewal on time, in grace, and after grace; renewal while frozen; cancelled and notice-period memberships rejected; client price ignored; idempotency; 5 parallel renewals of the same membership apply one at a time with correct cumulative end dates; subscription restriction and inactive gym are enforced.
```

---

## Step 5: Voids and credit notes

**Why:** `voidPayment` leaves the membership extended, issues no credit note, and can run after the shift is closed.

```text
TASK: Make voids safe and traceable.

1. POST /v1/payments/:id/void: owner only. Reason required. Only allowed while the payment's shift is still OPEN (reject with SHIFT_CLOSED otherwise; after closeout the correction is a credit note flow, which we will add later).
2. In one transaction: set payment.status = 'voided' with void_reason, and issue a credit note: doc_type 'credit_note', series CN from its own locked counter, original_invoice_id set, amounts mirror the original with the sign convention you already use for reversals. Credit notes and invoices are immutable.
3. Reverse the membership effect: if the payment created a purchase or renewal adjustment and NO later adjustments or freezes exist for that membership, insert a reversing adjustment (kind 'correction') restoring the previous end date and, for a new membership, set status 'cancelled' with reason 'voided_sale'. If later adjustments or freezes exist, reject with VOID_NOT_ALLOWED and explain.
4. Exclude voided payments from the shift's expected cash and from reports.
5. Write the audit entry inside the transaction.

Tests: void before closeout reverses a new membership; void after closeout is rejected; void with later freeze rejected; credit note numbering is gapless and separate from invoices; expected cash for the shift excludes the voided amount; only owner can void; double void is harmless.
```

---

## Step 6: Month-end date helper

**Why:** the end-date code uses JavaScript date overflow. I ran it: a 1-month plan starting 31 January ends on **2 March**, and one starting 30 January ends on 1 March.

```text
TASK: Fix month arithmetic in one shared helper and use it everywhere.

1. In packages/shared add addMonthsClamped(dateStr, months) and computeInclusiveEndDate(startDateStr, unit, value) working on 'YYYY-MM-DD' strings (UTC arithmetic only, no local timezone). Rule for months: target = start plus n months, where a start day that does not exist in the target month is clamped to the last day of that month. If the start day existed in the target month (no clamping), end = target minus 1 day (15 Jan, 1 month: ends 14 Feb). If clamping happened, end = the last day of the target month (31 Jan, 1 month: ends 28 Feb 2026 and 29 Feb 2028; 30 Jan: ends 28 Feb 2026; 31 Mar: ends 30 Apr). Units: day (end = start + value - 1 days), month, year (= 12 months; 29 Feb 2028 for 12 months ends 28 Feb 2029).
2. Replace every copy: computeInclusiveEndDate in memberships.service.ts, the inline date math in payments.service.ts, and any freeze, renewal or report code that does date arithmetic. Search for Date.UTC(, setUTCDate, getUTCMonth, setUTCMonth and addDays across apps/api and packages/shared.
3. Document the rule in Memory.md.

Tests (table-driven, must all pass): 1-month plans starting 2026-01-29, 01-30, 01-31, 02-01, 02-28, 03-31, 12-31; 3-month plan from 2025-11-30; 12-month plans from 2028-02-29 (ends 2029-02-28) and 2027-02-28 (ends 2028-02-27); 30-day and 90-day plans across year ends; start dates in every month. Also add a property-based test (fast-check): end >= start, and the term length (end - start + 1) is between 28 and 31 days for 1-month plans. Also assert that with continuous renewals the next term's start is always the previous end plus one day.
```

---

## Step 7: Audit trail rebuild

**Why:** one global chain with a read-then-insert race; the hash leaves out actor role, admin actor, reason, IP, device and time; no triggers; failures are swallowed; logging runs outside the transaction.

```text
TASK: Make the audit trail tamper-evident, race-safe and transactional.

1. Schema (migration): add chain_key text not null (the gym uuid, or 'platform' for platform-level rows) and hash_version smallint default 2 to audit_logs. Index on (chain_key, id). Dev data is disposable: reset the audit table by resetting the dev database.
2. AuditService.log(entry, tx?): accept an optional transaction handle and ALWAYS write on that handle when given. Take pg_advisory_xact_lock(hashtextextended(chain_key, 0)) before reading the previous hash for that chain. Chains are per gym plus one platform chain.
3. row_hash = SHA-256 over a canonical JSON of ALL of these fields: hash_version, chain_key, prev_hash, id-independent fields (gym_id, actor_user_id, actor_role, admin_actor_id, action, entity_type, entity_id, reason_code, payload, ip, device) and created_at as an ISO string with millisecond precision. Set created_at in code (truncated to ms) before hashing so the stored value equals the hashed value. Use stable key ordering.
4. verifyChainIntegrity(chainKey, limit?) verifies one chain: each prev_hash equals the previous row's row_hash, and each row_hash recomputes. Update POST /v1/gyms/audit-logs/verify to verify the caller's gym chain; add a platform superadmin endpoint for the platform chain.
5. Triggers via a custom migration: a function forbid_update_delete() raising an exception, attached BEFORE UPDATE OR DELETE to audit_logs, invoices, membership_adjustments and check_ins. Verify the SchemaGuard also checks these triggers exist (production refuses to start if missing).
6. Fail-closed for critical actions: payments, voids, sales, renewals, adjustments, freeze approvals and lifts, gym verification decisions, admin promotions and suspensions, and PIN changes must call log(entry, tx) INSIDE their business transaction so a failed audit write rolls the action back. Only non-critical read-style events may use a best-effort call that logs the failure to the application log.
7. Update every existing call site that runs inside a db.transaction to pass the tx handle.
8. Never include secrets, PINs or tokens in payloads. Add a test helper that scans audit payloads for forbidden key names (password, pin, secret, token).

Tests: 50 parallel log writes on one gym produce a valid unforked chain; chains of two gyms do not interfere; changing any single field (including actor_role, admin_actor_id, reason_code, ip, device, created_at) makes verification fail; UPDATE and DELETE are rejected by the trigger; a business transaction that fails after an audit write leaves no audit row; a forced audit failure rolls back a sale.
```

---

## Step 8: Authentication and platform hardening

**Why:** email verification is not enforced, bearer auth is a cookie hack that breaks with secure cookies, TLS verification is off, CORS is hardcoded, and the app has no input validation, rate limits or security headers.

```text
TASK: Auth and HTTP hardening in apps/api.

A. Email verification and password reset (auth.ts, email service):
1. Configure Better Auth: emailAndPassword { enabled: true, requireEmailVerification: true, minPasswordLength: 10, sendResetPassword }, emailVerification { sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: true, sendVerificationEmail }. Wire them to EmailService. In development without a provider, log the link to the console. Provider chosen by env (EMAIL_PROVIDER, keys); no keys in the repo.
2. POST /v1/gyms requires an email-verified user (403 EMAIL_NOT_VERIFIED).
3. Update the e2e flow and tests to verify the email using a test email sink that captures the token.

B. Bearer authentication:
4. Remove the AuthGuard hack that copies the Authorization token into a cookie named better-auth.session_token. Add the official Better Auth bearer plugin and use it. Confirm cookie and bearer both work with useSecureCookies true and false.

C. Database TLS and pools:
5. Remove ssl { rejectUnauthorized: false } everywhere (auth.ts, db.module.ts, scripts). Use certificate verification (sslmode=verify-full in the URL or ssl { rejectUnauthorized: true }); no SSL only for a plain local database.
6. Share ONE pg Pool between Better Auth and the Drizzle DbModule if feasible; otherwise set max connections to 5 on each and document why.

D. HTTP layer (main.ts):
7. CORS origins from TRUSTED_ORIGINS (comma-separated); no hardcoded localhost in production. Same list used by Better Auth trustedOrigins.
8. Add helmet, a 1 MB body size limit, app.enableShutdownHooks(), a request-id middleware (X-Request-Id, included in logs and error responses), and a global exception filter returning { code, message, requestId } using the stable error codes.
9. Input validation: create a ZodValidationPipe and validate EVERY body, query and path parameter with schemas in packages/shared. Remove every body typed any, Record<string, unknown> or hand-typed object. Use Zod coerce with bounds for numeric query parameters (limit 1 to 100, offset >= 0); no unchecked parseInt.
10. Rate limits: Better Auth rateLimit enabled with stricter rules for sign-in, sign-up and password reset; @nestjs/throttler globally (100 per minute per IP) and stricter on PIN, sales, check-in and verification-email endpoints.

Tests: unverified user cannot sign in or create a gym; verification and reset links work and tokens are single use; bearer works; a cookie request from an untrusted origin is rejected; invalid bodies return VALIDATION_FAILED with field paths; the 6th sign-in attempt in a minute is rate limited; no response ever leaks a stack trace.
```

---

## Step 9: Guard coverage, roles and routes

**Why:** `ActiveGymGuard` is on only six routes, the staff list is open to every staff role, `outbox/enqueue` lets owners send arbitrary email, and a route is shadowed.

```text
TASK: Make authorization consistent and deny-by-default.

1. ActiveGymGuard: apply at controller level to every tenant controller (members, plans, memberships, sales, payments, shifts, freezes, attendance, branches, staff, reports, documents-excluded). Add a decorator @AllowInactiveGym() for the few routes pending, rejected or suspended gyms may use: reading the gym profile and status, editing the profile, uploading verification documents, resubmitting, reading billing status. For non-active gyms, all other non-GET routes return 403 GYM_NOT_ACTIVE with the current status.
2. Write a test that walks ALL routes (from Nest route metadata) and fails if a tenant route has neither ActiveGymGuard nor @AllowInactiveGym(), or has a bare RolesGuard without a roles list.
3. Roles: GET /v1/gyms/staff only owner and manager. State explicit roles on every mutating route; document them in Memory.md as an endpoint-by-role table.
4. Branch access: create BranchAccessService. Staff whose branch scope is 'selected' only see and use their branches: branch list, shifts, sales, attendance, members' home branch. Test with a selected-scope front desk user.
5. Remove POST /v1/outbox/enqueue (system code only creates notifications from templates; recipients must be members of the gym). Keep read endpoints if they are role-restricted.
6. Platform controller: fix route order so gyms/review-queue is declared before gyms/:id; delete the duplicate review-queue endpoint.
7. Payment accounts: keep ONE endpoint set (GET and PUT /v1/gyms/payment-account) that stores only provider and provider_account_id and status. Delete payment-config and payment-accounts routes and remove secretKey, keySecret and webhookSecret from every shared schema and the database. 
8. Gym profile (updateGymProfile): validate with a strict Zod schema; timezone must be a valid IANA zone (Intl check); settings are merged only from an ALLOWLIST of keys (document it; managerPin and secrets are never settable). If an ACTIVE gym changes legalName, tradeLicenseNumber, tradeLicenseExpiry, trnNumber or vatRegistered, set status back to 'pending_verification', audit it, and email the owner.
9. One-gym cap: count only gyms owned by the user whose status is pending_verification, active or suspended; rejected and closed gyms do not count. Add POST /v1/gyms/:id/resubmit (owner only, status 'rejected' to 'pending_verification', rejection reason cleared, audited).

Tests: a pending, rejected and suspended gym is blocked on every gated route and allowed on the allowlist routes; front desk cannot list staff; selected-branch staff cannot see other branches; re-verification triggers on a TRN change; a rejected owner can fix and resubmit; the cap does not count rejected gyms.
```

---

## Step 10: Check-in logging and cancellation

**Why:** denied scans are not logged (only the "allowed" row is inserted), and `cancelEffectiveDate` is not checked.

```text
TASK: Log every check-in decision and honour cancellation dates.

1. In check-in.service.ts, write a check_ins row for EVERY decision before returning or throwing: result 'allowed' or 'denied', deny_reason (expired, frozen, cancelled, unpaid, wrong_branch, outside_schedule, not_found), method, device_id, verified_by, member_id and membership_id when known. Keep the duplicate-tap guard.
2. Deny when cancelEffectiveDate is set and the gym-local today is after it, regardless of the status column.
3. Keep validity computed from dates in the gym timezone; the status column is only a cached label. Lazy settlement of due freezes still runs first.
4. Denials return the same error codes as now, but the denial row is committed even though the request fails (log in its own transaction or before throwing).
5. Staff only: the access endpoints stay restricted to staff scanning at their own branch (BranchAccessService from Step 9). Rename any endpoint called self-tap that suggests member self-service.
6. check_ins is append-only (trigger from Step 7).

Tests: a denied scan creates a 'denied' row with the right reason for each reason; allowed scans create one row; duplicate taps within the guard window create none; cancellation date passed denies even when status is still 'active'; a frozen member is denied with 'frozen'.
```

---

## Step 11: Proof uploads (constrain now)

**Why:** `attachProof` trusts a client-supplied `storageKey` and hash, and purging deletes only database rows.

```text
TASK: Constrain freeze proofs until real storage exists.

1. POST /v1/freezes/:id/proofs must not accept a free-form storageKey from the client. Add a StorageService interface with createUploadTarget(gymId, freezeId, mime, size) returning a server-generated key shaped gyms/{gymId}/freezes/{freezeId}/{uuid} and an upload instruction. Implement a local-disk development version and leave a clear TODO for the private UAE-region bucket with presigned URLs.
2. Accept only application/pdf, image/jpeg and image/png, maximum 5 MB, and record the sha256 computed by the SERVER after upload.
3. delete_after = the verification date + 30 days once a reviewer verifies or rejects the proof (and upload date + 90 days if never reviewed). The daily job from Step 2 deletes both the row and the file through StorageService.delete.
4. Only owner and manager can view a proof, every view is audited, and platform admins can never view proofs.
5. The review UI or API shows a short-lived download URL only.

Tests: client-supplied keys are rejected; wrong mime or oversize rejected; purge removes row and file; platform admin cannot fetch a proof; every view creates an audit row.
```

---

## Step 12: Tests and CI

```text
TASK: Replace the .cjs e2e script with a real automated suite and add CI.

1. Add Vitest (or Jest) with Supertest in apps/api. Tests run against TEST_DATABASE_URL only; refuse to run if the URL does not match the dev/test name rule from Step 0. Each run applies migrations to a clean schema.
2. Port every stage from test-e2e-flow.cjs into tests; delete the script when the suite is green.
3. Required test groups (create the ones not yet covered by earlier steps): cross-tenant negative tests for EVERY tenant route (gym B cannot read or change gym A data; the response is 404 not 403); role matrix per endpoint; parallel invoice numbering; parallel freeze overlap (exactly one success); idempotency; month-end dates; timezone boundaries; audit chain concurrency and tamper detection; schema guard (production start fails when a constraint or trigger is missing); no-secrets scan over all responses and audit payloads.
4. Add .github/workflows/ci.yml: on every push and pull request: checkout, pnpm install, build, typecheck, start a PostgreSQL service container, run drizzle migrations on an empty database, run the test suite. Add a step that regenerates the Drizzle schema and fails if there is any drift against the migrations.
5. Add a pnpm test script at the repo root.

Report the test count by group and the CI run result.
```

---

## Step 13: Documentation matches reality

**Why:** `phases.md` and `PRD.md` describe Row-Level Security, TOTP two-factor, Argon2id, refresh tokens, a `TenantRepository`, append-only triggers and `pg_trgm` as done. None of them exist in the code.

```text
TASK: Make the documentation true.

1. Search phases.md, PRD.md, Memory.md, README.md and CHALLENGES.md for claims about: Row-Level Security, TOTP or two-factor, Argon2id, refresh tokens, TenantRepository, pg_trgm, append-only triggers, migration file names, and anything else that does not exist. For each claim, mark it in a table (claim, file, line, status in code: implemented / not implemented / partly). Show me the table first.
2. Rewrite the documents so they only describe what exists. Move unbuilt items into a "Planned, not built" list. Fix migration file names, the schema list (include every table), the endpoint-by-role matrix (including freezes, sales, attendance, shifts, reports), environment variables (TRUSTED_ORIGINS, EMAIL_PROVIDER and keys, STORAGE settings, ALLOW_DB_RESET, PLATFORM_ADMIN_EMAIL), run commands, the date rule from Step 6, and the deviations from the specification.
3. Record the known open items: platform admins share the customer login (no second factor yet), database region is Frankfurt while proofs must be UAE-hosted, no Row-Level Security backstop, payment gateways not integrated.
4. Never put real secrets, database URLs or tokens in any document.
```

---

## Step 14: First real screens (after Steps 0 to 13)

```text
TASK: Connect apps/web to the API with the first real flow. Do not add features beyond this.

Build, with React Router, TanStack Query and the shared Zod schemas: (1) sign up, verify-email notice, sign in, sign out; (2) create gym (shows verification status: pending, rejected with reason and resubmit, active); (3) platform admin review queue (approve and reject with reason); (4) the desk: member search, create member, sell membership (plan, method, optional discount for managers) with receipt view; (5) open and close shift with blind cash count. Use the API's cookie sessions with credentials included; the Vite proxy forwards /v1. Show API error codes as readable messages. No placeholder or mock data. List every API route you needed that was missing or awkward.
```

---

## Final checklist before you move on to new features

- [ ] No default PIN, no `asOfDate`, no client-supplied prices, currency or shift ids.
- [ ] No membership can exist as `active` without a payment, except through the complimentary flow.
- [ ] Month-end tests pass (31 January plus one month gives 28 February).
- [ ] Audit chain: one chain per gym, locked, all columns hashed, triggers on, written inside business transactions.
- [ ] Email verification enforced; CSRF, TLS verification, CORS and rate limits on.
- [ ] Every tenant route is either guarded by the gym-active check or explicitly allowed for inactive gyms.
- [ ] Denied check-ins are logged.
- [ ] CI is green; cross-tenant and concurrency tests pass.
- [ ] Documents match the code.

## Later (not part of this pass)

Row-Level Security backstop, a real second factor for platform admins, staff invitations by email, `GET /v1/me`, real private proof storage in a UAE region, the Tap and Razorpay integrations, and a move to a queue library such as pg-boss when the job volume needs it.
