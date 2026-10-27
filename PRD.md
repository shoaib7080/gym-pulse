# GymPulse Platform — Product Requirements Document (PRD)

> **Specification Reference:** GymPulse Platform Specification (Draft for Review, 18 October 2026)  
> **Target Market:** UAE and wider GCC (Independent gyms, boutique clubs, multi-branch chains)  
> **Architecture:** Multi-Tenant Modular Monolith (NestJS + PostgreSQL + Drizzle ORM + React/Vite + Expo)

---

## 1. Executive Summary & Purpose

**GymPulse** is an enterprise-grade multi-tenant SaaS engineered specifically for fitness businesses in the UAE and GCC. The platform resolves key operational bottlenecks in gym operations:
1. **Reception Disputes & Manual Negotiations:** System-enforced membership validity, freeze allowances, and policy-driven access control.
2. **Revenue Leakage:** Elimination of unrecorded cash sales and unauthorized manual membership extensions via mandatory cashier shifts, blind register closeouts, and mandatory reason logging.
3. **Regulatory Compliance:** 100% UAE VAT-compliant billing (5% VAT in integer fils), bilingual (English & Arabic) tax invoices/simplified invoices/receipts, gapless sequential numbering, and Peppol e-invoicing readiness.
4. **Direct Settlement:** Member payments settle directly to each gym's bank account via provider connected accounts (GymPulse never holds member funds).
5. **Retention via Structured Freezes:** Flexible, policy-driven freeze engine with self-service requests, proof validation, automated extensions, and early-lift date math.

GymPulse generates revenue through separate SaaS subscriptions billed directly to gyms.

---

## 2. Personas and Role-Based Access Control (RBAC)

The system enforces strict multi-tenancy and role boundaries across 5 user categories:

| Persona / Role | Scope | Key Capabilities |
| :--- | :--- | :--- |
| **Platform Admin** | Global (GymPulse Staff) | Onboard & verify gyms (TRN, trade licenses), manage SaaS subscription plans, global tenant health, time-boxed audited tenant impersonation. |
| **Gym Owner** | Single Gym (All Branches) | Connect gym payment accounts, view financial analytics, configure plans and freeze policies, manage staff & permissions, void payments (open shifts), view GymPulse SaaS billing. |
| **Branch Manager** | Single Gym (Assigned Branches) | View branch financial & check-in analytics, manage members, approve/reject freeze requests, waive freeze notice, approve register cash variances, lift freezes with PIN. |
| **Front Desk** | Single Gym (Assigned Branches) | Open cashier shifts, register members, record cash/POS/bank transfer sales, blind closeout registers, scan QR check-ins, manual check-in with reason, request early freeze lift. |
| **Member** | User / Multi-Gym Customer | View active membership pass, generate rotating Ed25519 QR tokens, submit freeze requests, view tax invoices & receipts, manage consents. |

---

## 3. Core Functional Requirements

### 3.1 Tenancy & Data Isolation (Three-Layer Security)
1. **Layer 1 (Application Guard):** Every API request resolves gym and branch context from authenticated staff/member assignment (`TenantGuard`). Requests without tenant context are rejected with `403 FORBIDDEN` / `TENANT_MISMATCH`.
2. **Layer 2 (Data Access Layer):** All database queries use repository abstractions (`TenantRepository`) enforcing `WHERE gym_id = :gymId`. Raw un-scoped handles are strictly restricted to `PlatformAdmin`.
3. **Layer 3 (Database RLS Backstop):** PostgreSQL Row Level Security (RLS) is enabled on all tenant tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). The connection pool executes `set_config('app.gym_id', gym_id, true)` in each request transaction. Non-RLS queries fail at the database engine level.

### 3.2 Authentication & Security
- **Staff & Admin Auth:** Email + password hashed with **Argon2id**. Mandatory **TOTP MFA** (RFC 6238) for Owners, Managers, and Platform Admins.
- **Session Tokens:** `httpOnly`, `Secure`, `SameSite=Lax/Strict` cookies with short-lived 15-minute access JWTs and 30-day rotating refresh tokens stored hashed with reuse detection.
- **Member Auth:** Passwordless mobile/web authentication via Phone Number (E.164) with SMS / WhatsApp OTP and IP/phone rate limiting.
- **Permission Caching:** User permissions are cached in-memory for at most 60 seconds and invalidated immediately upon permission changes.

### 3.3 Plans & Prepaid Memberships
- **Plan Definitions:** Duration (days or months), base price, VAT inclusive/exclusive flag, grace period (days), branch access (`home_only` vs `all_branches`), and access schedules (peak/off-peak).
- **Date Calculation:** Inclusive end date: `end_date = start_date + duration - 1 day`. All calculations executed in gym's local timezone (`gyms.timezone`).
- **Date Ledger (`membership_adjustments`):** Membership end dates are **never mutated directly**. Every change (purchase, renewal, freeze, early lift, complimentary, correction) inserts a ledger row. Complimentary and correction adjustments require a mandatory explanatory reason.
- **Renewals:** Paid on or before `end_date + grace_days` continues seamlessly from `current_end_date + 1`. Late renewals start on payment date.

### 3.4 Freeze Engine
- **Hierarchical Policies:** Gym-level master freeze policy with plan-specific overrides.
- **10-Step Eligibility Verification:**
  1. Policy enabled for gym & plan (`FREEZE_NOT_ENABLED`)
  2. Membership status active (`MEMBERSHIP_NOT_ELIGIBLE`)
  3. No unpaid balance (`BALANCE_OUTSTANDING`)
  4. Notice period respected: `start_date >= today + notice_days` (`FREEZE_NOTICE_TOO_SHORT`)
  5. Minimum freeze duration met: `requested_days >= min_days` (`FREEZE_TOO_SHORT`)
  6. Remaining quota available (`FREEZE_QUOTA_EXCEEDED`)
  7. Occurrence limit not exceeded (`FREEZE_QUOTA_EXCEEDED`)
  8. Freeze falls within current membership term (`FREEZE_OUTSIDE_MEMBERSHIP`)
  9. No overlapping or adjacent freeze: PostgreSQL `EXCLUDE USING gist (membership_id WITH =, daterange(start_date, end_date + 2, '[)') WITH &&)` (`FREEZE_OVERLAP`)
  10. Proof attached if policy requires (`PROOF_REQUIRED`)
- **Date Math & Quota Settlement:**
  - Full freeze: `days_charged = end_date - start_date + 1`. Membership extended by `days_charged` upon completion.
  - Early lift: `days_used = lifted_on - start_date`. `days_charged = min(requested_days, max(days_used, min_days))`. Unused days (`requested_days - days_charged`) return to quota.

### 3.5 Check-In & Access Control
- **Dynamic Pass Token:** Member app generates high-security QR codes every 30 seconds signed with **Ed25519**. Token contains `jti`, `member_id`, `gym_id`, `issued_at`, and `expires_at` (45-second TTL).
- **Replay Protection:** Scanned tokens are checked against unlogged PostgreSQL table `used_pass_tokens`. Conflict on `jti` rejects immediately with `TOKEN_REPLAYED`.
- **Desk Scanner Flow:** USB HID barcode scanner / webcam capture -> API verification against computed validity (Section 6.2) -> Result pushed in real-time to front-desk monitor via Socket.IO branch room.
- **Desk Search & Manual Override:** Fast Ctrl+K search over normalized names, phones, and member numbers using PostgreSQL `pg_trgm` GIN indexes. Manual check-ins log required reasons (`desk_search`).

### 3.6 Cash Control & Front Desk POS
- **Cashier Shifts:** Front desk staff must open a shift with an `opening_float_minor`. All desk payments require an active shift.
- **Blind Register Closeout:** At shift close, the cashier performs a blind count of physical cash and POS terminal slips before expected amounts are revealed.
- **Variance Handling:** Server computes `variance_minor = counted_cash - expected_cash`. Variances beyond gym tolerance trigger manager/owner approval workflows and email digests.
- **Tamper-Evident Audit Chain:** Append-only `audit_logs` table protected with PostgreSQL trigger forbidding updates/deletes. Every row carries `sha256(prev_hash || canonical_row)`, verified nightly.

### 3.7 Invoicing, VAT & Payments
- **Integer Math in Fils:** Stored as `bigint`. UAE VAT at 5% (500 bps).
  $$\text{base} = \text{round\_half\_up}\left(\frac{\text{total} \times 10000}{10000 + \text{vat\_rate\_bps}}\right), \quad \text{vat} = \text{total} - \text{base}$$
- **Gapless Numbering:** Atomic increment on `invoice_counters` using `UPDATE ... RETURNING next_number - 1` with row-level locks. Rollback preserves numbering continuity.
- **Document Types:** `tax_invoice` (VAT-registered gym with TRN), `simplified_tax_invoice`, `credit_note`, and `receipt` (non-VAT gyms).
- **Bilingual Invoices:** English and Arabic structured formatting with RTL support.
- **Direct Settlement:** Gym connects their merchant account (Stripe Connect / Tap / etc.). Member payments settle directly to gym's bank account.

### 3.8 GymPulse SaaS Subscriptions
- Gyms pay monthly or yearly subscriptions (`saas_plans`) to GymPulse.
- Automated dunning lifecycle: `active` -> `past_due` (grace period) -> `restricted` (+14 days: pauses new sales & freezes) -> `suspended` (+30 days: disables check-in, read/export only).

---

## 4. Non-Functional Requirements & Performance SLAs

| Metric | Target |
| :--- | :--- |
| **Check-in Verification Latency** | p95 < 300 ms (server processing) |
| **Desk Alert WebSocket Delivery** | < 1,000 ms end-to-end |
| **General REST API Endpoints** | p95 < 500 ms |
| **System Availability** | 99.5% (MVP), 99.9% (Phase 2+) |
| **Disaster Recovery** | RPO: 5 minutes (point-in-time recovery), RTO: 4 hours |
| **Capacity Sizing (Design Target)** | 200 gyms, 100,000 active members, peak 50 scans/min per branch |
| **Security Standard** | OWASP ASVS Level 2 compliance |
