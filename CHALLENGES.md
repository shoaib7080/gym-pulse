# GymPulse Architectural Crossroads & Engineering Challenges

> **Document Purpose**: Authoritative tracking of high-stakes architectural, operational, and regulatory challenges encountered during the design and construction of **GymPulse** (Multi-Tenant SaaS for independent gyms, boutique clubs, and fitness chains in the UAE, GCC, and international markets).
>
> **Scope**: This document records strategic engineering crossroads where multiple viable paths existed, trade-offs were systematically weighed, and definitive architectural decisions were executed. Trivial bugs, syntax errors, and UI iterations are strictly excluded.

---

## 🧭 Decision Matrix Overview

| ID | Domain | Crossroads | Chosen Path | Primary Driver |
| :--- | :--- | :--- | :--- | :--- |
| **[CH-001](#ch-001-direct-charges-vs-destination-charges-in-stripe-connect-uae-market)** | Payments & Compliance | Direct vs. Destination Charges in Stripe Connect | Destination Charges (`on_behalf_of`) | UAE FTA VAT MoR & Aggregator Licensing Limits |
| **[CH-002](#ch-002-access-control-hardware-decoupling-vs-immediate-turnstile-integration)** | Access Control & IoT | Immediate Turnstile Integration vs. Hardware Decoupling | Decoupled Software-First (`CheckInService` Adapter) | Eliminate On-Site ELV Network Deployment Friction |
| **[CH-003](#ch-003-multi-tenant-data-isolation-strategy-baas-policies-vs-server-enforced-rls)** | Core Architecture | Client BaaS RLS vs. Server-Enforced Three-Layer Isolation | Modular Monolith (Guards + Scoped Repos + RLS Backstop) | Financial Invariant Integrity & Audit Hash Chains |
| **[CH-004](#ch-004-whatsapp-cloud-api-cost-explosion-in-dunning-workflows)** | Messaging & Dunning | Omnichannel WhatsApp vs. Push-First Tiered Hierarchy | Push/Email Primary; WhatsApp Reserved for T-1 & Invoices | Prevent Meta Conversation Fees Exceeding SaaS MRR |
| **[CH-005](#ch-005-mobile-authentication--app-store-review-rejection-risks)** | Identity & Mobile | Regional Phone OTP vs. Social Logins vs. Apple Guideline 4.8 | First-Party Identity Core; No Social OAuth Without Apple | Eliminate App Store Rejections & Telecom Toll Fraud |
| **[CH-006](#ch-006-anti-skimming-desk-cash-control-vs-staff-operational-friction)** | POS & Audit Trail | Trust-Based Cash Handling vs. Blind Shift Reconciliation | Blind Drawer Closeout + Immutable Adjustment Ledgers | Prevent Reception Cash Skimming & Unearned Free Days |
| **[CH-007](#ch-007-multi-region-payment-strategy-gcc-vs-india-vs-international)** | Payments & Expansion | Monolithic Stripe vs. Multi-Gateway Regional Factory | `PaymentProviderFactory` (Tap for GCC, Razorpay for India) | mada/Jaywan/UPI Dominance & Stripe India Invite Limits |

---

### [CH-001] Direct Charges vs. Destination Charges in Stripe Connect (UAE Market)
- **Context & Problem Statement**: 
  GymPulse operates as a B2B SaaS platform enabling independent fitness clubs across the UAE and GCC to process recurring memberships, walk-in day passes, and point-of-sale retail. The platform must monetize via an automated software processing fee (platform take-rate) while seamlessly onboarding merchant gyms. In the UAE, the regulatory framework governing digital commerce presents two severe constraints:
  1. Under the UAE Federal Tax Authority (FTA) VAT regulations, gym memberships are subject to 5% VAT. The gym is legally required to issue a Tax Invoice displaying its unique 15-digit Tax Registration Number (TRN) and legal corporate entity name.
  2. Operating as the legal Merchant of Record (MoR) across hundreds of unrelated gym facilities exposes the platform to UAE Central Bank Stored Value Facility (SVF) / Payment Aggregator licensing mandates, as well as catastrophic chargeback liability if a gym abruptly closes its doors.
- **Options Evaluated**:
  - *Option A: Direct Charges on Connected Accounts*. The member transacts directly with the gym’s connected Stripe account. The platform collects an `application_fee_amount` on each charge.
  - *Option B: Destination Charges with `on_behalf_of: connected_account_id`*. The charge is initiated on the platform account and immediately transferred to the gym’s connected account, while explicitly specifying the connected account as the merchant of record for statement descriptors, settlement, and customer liability.
  - *Option C: Separate Charges and Transfers*. The platform charges the member as the primary merchant, pools funds in the platform balance, and asynchronously transfers net payouts to the gym via the Transfers API.
- **Trade-Offs & Failure Modes**:
  - *Option A Failure Mode*: Direct Charges require the connected account to have full merchant capabilities and handle all payment method activations independently. In the UAE, Stripe Standard accounts force gym owners into complex dashboard configurations. Local card schemes and Apple Pay domain registrations must be performed per gym, resulting in a fragmented checkout experience and high onboarding abandonment.
  - *Option C Failure Mode*: Separate Charges position GymPulse as the legal Merchant of Record. This creates a severe tax failure mode: the platform would have to recognize the gross membership fee as revenue, collect 5% UAE VAT across all gyms, and assume 100% financial liability for chargebacks when gyms default on annual contracts. Furthermore, holding and pooling funds triggers UAE Central Bank payment intermediary scrutiny.
- **Chosen Path & Resolution**:
  - GymPulse adopted **Destination Charges with `on_behalf_of: connected_account_id`** (ADR D-6).
  - The platform initiates the `PaymentIntent` centrally, deduplicating checkout sessions and retaining control over available payment method types (e.g., Apple Pay, credit/debit cards).
  - By passing `on_behalf_of: connected_account_id`, Stripe automatically assigns settlement, cardholder dispute liability, and statement descriptors to the gym’s legal entity.
  - The platform deducts its software take-rate via `application_fee_amount` in a single atomic database and gateway transaction, completely eliminating fund-pooling and aggregator regulatory exposure while guaranteeing that the gym's legal TRN appears on all downstream VAT invoices.
- **Future Revisit Trigger**:
  - When GymPulse introduces an "Incubator / Micro-Studio" tier for unbanked personal training pods lacking corporate trade licenses, requiring a full Merchant of Record (MoR) reseller structure under a specialized licensed financial entity.

---

### [CH-002] Access Control Hardware Decoupling vs. Immediate Turnstile Integration
- **Context & Problem Statement**:
  Prospective gym owners universally request automated physical turnstile access control (tripod gates, flap barriers, magnetic door locks) upon initial sales engagement. However, physical ELV (Extra-Low Voltage) access control in the GCC fitness sector is plagued by extreme vendor fragmentation: legacy on-premise hardware (ZKTeco, Hikvision, Dahua, Suprema), proprietary RS-485 / Wiegand 26/34-bit communication protocols, dynamic consumer ISP connections lacking static public IPs, and hostile local network environments (symmetric NATs, firewalls, and frequent fiber/4G dropouts). Integrating physical hardware in Phase 1 threatened to stall software go-to-market and overwhelm engineering with on-site deployment debugging.
- **Options Evaluated**:
  - *Option A: Immediate Turnstile Integration with On-Premise IoT Bridge*. Ship or certify an on-premise edge gateway (e.g., Raspberry Pi or industrial Linux edge box) installed on the gym’s local LAN to interface with ZKTeco/Hikvision controllers via proprietary SDKs and communicate with GymPulse over persistent WebSockets/MQTT.
  - *Option B: Proprietary Cloud-Managed Hardware Lock-In*. Manufacture or partner with a single hardware provider, mandating that gyms purchase GymPulse-branded turnstile controllers pre-configured with embedded 4G cellular IoT eSIMs.
  - *Option C: Decoupled Software-First Architecture with Abstract Adapter Pattern*. Launch Phase 1 exclusively with high-speed software ingress (USB/Bluetooth HID barcode/QR desk scanners, browser camera scanning, global `Ctrl+K` desk check-in, and a temporary mobile app self-tap). Decouple all check-in processing behind an abstract `CheckInService`, deferring physical relay controllers to Phase 2/3.
- **Trade-Offs & Failure Modes**:
  - *Option A Failure Mode*: Edge hardware bridges introduce massive operational drag. If a gym's local Wi-Fi drops or the local DHCP server reassigns the turnstile IP, members are physically locked outside the gym during peak morning hours (6:00 AM–8:00 AM). The software platform absorbs the blame for third-party local network failures, generating high-severity emergency support tickets and customer churn.
  - *Option B Failure Mode*: Mandating proprietary hardware escalates gym upfront capital expenditure by $3,000–$8,000, extending sales cycles from 48 hours to 3–6 months and turning a high-margin SaaS startup into a low-margin hardware logistics company.
- **Chosen Path & Resolution**:
  - GymPulse executed **Option C: Decoupled Software-First Architecture** (ADR D-15, ADR D-20, ADR D-22).
  - Physical turnstiles were explicitly de-scoped from Phase 1. The desk reception workflow was optimized for sub-second execution using off-the-shelf USB/Bluetooth HID scanners (which emulate keyboard keystrokes without drivers) and a keyboard-first `Ctrl+K` search bar.
  - For mobile members, a temporary honor-system in-app check-in (`POST /v1/access/self-tap`) was introduced as an ingress transport adapter. It emits a standardized `MemberCheckInAttemptEvent` to an abstract `CheckInService` (`ICheckInService`).
  - The check-in engine enforces strict domain validations: status must be `active` (rejects `frozen` with `FREEZE_ACTIVE`, expired with `MEMBERSHIP_NOT_ELIGIBLE`), evaluates plan grace periods, and enforces an 8-hour sliding cooldown per member (`429 SELF_CHECKIN_COOLDOWN_ACTIVE`).
  - Attendance records explicitly persist `method: 'self_tap_temporary'` and `verified_by: null`, preserving pristine data separation between unverified member app taps and verified desk visits.
  - An upsell banner in the Owner Dashboard ("Want automated turnstile gates? Request hardware quote") captures commercial demand for Phase 2 without blocking software revenue.
- **Future Revisit Trigger**:
  - Onboarding 50+ active gyms or securing enterprise multi-branch fitness chains where 24/7 unstaffed access is a non-negotiable contractual prerequisite.

---

### [CH-003] Multi-Tenant Data Isolation Strategy: BaaS Policies vs. Server-Enforced RLS
- **Context & Problem Statement**:
  GymPulse manages sensitive multi-tenant data across competing fitness facilities: member personal identities (PII), phone numbers, medical freeze documentation, cash drawer variance reports, and financial turnover figures. A data leak between competing gyms in the same metropolitan area would destroy the platform's commercial credibility. Modern Backend-as-a-Service (BaaS) ecosystems (e.g., Supabase) promote client-heavy architectures where web/mobile apps query PostgreSQL directly via auto-generated APIs backed by Row-Level Security (RLS) policies. The platform needed to balance rapid development velocity against non-negotiable financial, audit, and domain invariant integrity.
- **Options Evaluated**:
  - *Option A: Client BaaS SDKs with Database-Level RLS Policies*. Frontend applications query PostgreSQL directly using Supabase client SDKs. Multi-tenancy is enforced entirely within PostgreSQL RLS policies reading `auth.jwt() -> app_metadata -> gym_id`.
  - *Option B: Single-Database Monolith with Application-Layer WHERE Filtering*. All queries pass through a centralized API gateway that manually attaches `WHERE gym_id = ?` clauses in application code, connecting to PostgreSQL with a single privileged database user.
  - *Option C: Defense-in-Depth Modular Monolith (Guards + Scoped Repositories + Session RLS Backstop)*. A modular NestJS backend utilizing Drizzle ORM. Enforces three progressive isolation perimeters: Declarative Route Guards, Scoped Repository Helpers, and a non-superuser connection pool with session-variable RLS as a final database backstop.
- **Trade-Offs & Failure Modes**:
  - *Option A Failure Mode*: Client-direct BaaS bypasses backend domain services. Complex business logic—such as inclusive calendar date calculations, multi-table cash drawer balance reconciliations, GiST exclusion constraints for freeze overlaps, and cryptographic SHA-256 audit chaining—cannot be cleanly orchestrated or tested in pure SQL RLS without creating unmaintainable database stored procedures and triggers. Furthermore, a single missing policy or permissive boolean error instantly exposes all tenant data over public REST endpoints.
  - *Option B Failure Mode*: Relying exclusively on developers remembering to append `.where(eq(table.gymId, gymId))` in raw application code creates a high-probability human error vector. A single complex inner join or subquery omitting the tenant filter results in catastrophic cross-tenant data leakage on analytics, search, or export endpoints.
- **Chosen Path & Resolution**:
  - GymPulse implemented **Option C: Defense-in-Depth Three-Layer Isolation** (ADR D-1, ADR D-5, ADR D-14):
    1. **Perimeter Layer (Declarative Guards)**: Incoming requests must provide the target gym via `x-gym-id` header. `TenantGuard` intercepts execution, extracts caller session identity from Better Auth, and cryptographically asserts that the user possesses an active role in `staff_assignments` for that specific `gym_id`.
    2. **Domain Repository Layer (Mandatory Scoping Helpers)**: Direct un-scoped database queries are banned in code reviews. All database interactions must flow through `scopeToGym(table, gymId)` or `scopeEntityToGym(table, gymId, entityId)` within Drizzle ORM, ensuring tenant tenancy clauses are compile-time enforced.
    3. **Kernel Layer (Session RLS & Audit Integrity)**: Database connections utilize a restricted non-superuser PostgreSQL role. All mutating domain actions emit structured, immutable audit rows into `audit_logs` protected by SHA-256 hash chains (`prev_hash` linking to the genesis block `000...000`), guaranteeing tamper evidence.
- **Future Revisit Trigger**:
  - Compliance onboarding of tier-1 enterprise franchise networks (e.g., 50+ locations) requiring physical database schema-per-tenant or isolated dedicated database clusters for regional data residency certifications.

---

### [CH-004] WhatsApp Cloud API Cost Explosion in Dunning Workflows
- **Context & Problem Statement**:
  In the UAE and GCC, WhatsApp is the undisputed king of consumer communication, commanding 95%+ open rates and sub-10-minute read times, whereas promotional and transactional email open rates for fitness members frequently linger below 18%. To minimize subscription churn, automated dunning engines must aggressively remind members of expiring cards and upcoming renewals (e.g., T-14, T-7, T-3, T-1 days before expiry, day-of charge, +3 days overdue, +7 days overdue). However, Meta’s WhatsApp Cloud API bills on a per-conversation category model (Marketing, Utility, Authentication, Service) with 24-hour window pricing. Blasting a multi-stage dunning cadence over WhatsApp for a 500-member gym at $0.035 to $0.05 per conversation rapidly amasses $150–$300/month in Meta API charges, completely wiping out GymPulse's $49–$99/month SaaS subscription fee.
- **Options Evaluated**:
  - *Option A: WhatsApp-First Notification Engine*. Dispatch every reminder, renewal notice, payment receipt, and dunning prompt via Meta WhatsApp Cloud API to maximize member renewal conversions.
  - *Option B: Email & Push Only (Zero WhatsApp)*. Completely eliminate WhatsApp from automated workflows, relying strictly on Expo Push Notifications and transactional email (e.g., Postmark/SendGrid).
  - *Option C: Tiered Push-First Hierarchy with Selective WhatsApp Escalation*. Utilize zero-cost mobile push notifications and email for routine reminders, reserving paid WhatsApp Cloud API messages strictly for critical high-urgency transition events and legally mandated tax invoices.
- **Trade-Offs & Failure Modes**:
  - *Option A Failure Mode*: Financial insolvency. Because GymPulse bundles platform features into a predictable monthly subscription, unconstrained WhatsApp usage transforms the SaaS unit economics from a 78% gross margin software business into a negative gross margin telecom reseller.
  - *Option B Failure Mode*: Involuntary churn and gym owner dissatisfaction. Gym members routinely ignore automated emails and disable mobile push notifications. When memberships quietly lapse, gym owners suffer revenue loss and blame the platform for inadequate renewal automation.
- **Chosen Path & Resolution**:
  - GymPulse implemented **Option C: Tiered Push-First Hierarchy with Selective Escalation** (ADR D-4, Outbox Architecture):
    - **T-7 and T-3 Days (Routine Notices)**: Dispatched exclusively via zero-cost Expo Push Notifications (for members with the mobile app installed) and transactional email.
    - **T-1 Day (Urgent Final Warning)**: If the member has not completed renewal via app/web, the system escalates to WhatsApp Cloud API under the **Utility** template category ("Your gym membership expires tomorrow. Tap to renew and avoid re-registration fees").
    - **Overdue Dunning (+14d and +30d)**: Automated dunning status transitions (Restricted at +14d, Suspended at +30d) trigger WhatsApp utility alerts notifying the member that turnstile/desk check-in privileges are locked.
    - **Post-Payment Delivery**: The official FTA-compliant PDF VAT Tax Invoice is transmitted over WhatsApp Utility template, fulfilling UAE legal delivery requirements while satisfying member expectations.
    - **Architectural Safeguards**: Implemented a `NotificationOutbox` with SHA-256 idempotency keys, exponential backoff retries, and strict per-gym monthly WhatsApp budget caps. Excess outbound volume above tier allowances requires gym-funded prepaid credits.
- **Future Revisit Trigger**:
  - When Meta alters regional GCC conversation pricing, or when GymPulse introduces a "Bring Your Own WhatsApp Business Account (WABA)" feature for enterprise gyms.

---

### [CH-005] Mobile Authentication & App Store Review Rejection Risks
- **Context & Problem Statement**:
  Mobile phone numbers (E.164 format) represent the definitive primary digital identity in the UAE and wider GCC, tightly integrated into banking, national identity (UAE PASS), and local retail. Gym members expect to sign up and authenticate in mobile applications using their phone number and a one-time password (OTP). However, implementing mobile authentication presents two severe regulatory and operational hazards:
  1. **Apple App Store Review Guideline 4.8**: Any mobile application utilizing a third-party social login (such as Google Sign-In or Facebook Login) MUST offer "Sign in with Apple" with equivalent prominence. Failure to comply results in immediate App Store review rejection.
  2. **International SMS Toll Fraud (Traffic Pumping)**: Public SMS OTP verification endpoints are heavily targeted by international telecom fraudsters who deploy automated botnets to trigger premium-rate SMS OTPs, inflicting thousands of dollars in carrier termination fees within hours.
- **Options Evaluated**:
  - *Option A: Social-First Authentication (Google + Facebook)*. Provide quick one-tap social logins to maximize mobile onboarding conversion rates.
  - *Option B: Direct SMS OTP as the Universal Authentication Mechanism*. Require a phone number and SMS OTP for every login and registration event across web and mobile.
  - *Option C: First-Party Identity Model with Phased Verification & Strict Guideline 4.8 Compliance*. Anchor member identities to verified phone numbers and emails at the domain layer (`users` table). Implement Email/Password sessions for Phase 1 MVP; reserve SMS/WhatsApp OTP for Phase 2 behind carrier-grade rate limits, Cloudflare Turnstile bot protection, and mandatory Sign in with Apple pairing.
- **Trade-Offs & Failure Modes**:
  - *Option A Failure Mode*: Introducing Google Sign-In on mobile without full Apple Sign-In integration guarantees immediate iOS App Store rejection under Guideline 4.8. Furthermore, social logins frequently return obscure relay email addresses (e.g., `@privaterelay.appleid.com`), disconnecting the member from the front-desk profile where staff originally registered them by phone number.
  - *Option B Failure Mode*: Toll fraud vulnerability and high recurring operational costs ($0.035 to $0.06 per SMS in the UAE via Etisalat/du). For a freemium or low-tier SaaS model, unmitigated SMS OTP costs create an unsustainable burn rate before achieving product-market fit.
- **Chosen Path & Resolution**:
  - GymPulse adopted **Option C: First-Party Identity Model with Phased Verification** (ADR D-2, Identity Model):
    - Member identities are permanently anchored in the domain `users` table via UUID primary keys, linked to `auth_user` credentials via `users.auth_user_id`.
    - Members registered at the front desk receive a domain `users` row with `auth_user_id: null`, allowing them to claim their digital account later without creating orphaned duplicate records.
    - Phase 1 relies strictly on first-party Email & Password authentication powered by Better Auth, running against the primary database without third-party telecom or OAuth dependencies.
    - All third-party social login SDKs are strictly barred from the mobile codebase until Phase 2, where "Sign in with Apple" and Google Sign-In will be introduced concurrently alongside WhatsApp OTP (via Twilio Verify with anti-fraud geo-locking and IP velocity limits).
- **Future Revisit Trigger**:
  - Public submission of the GymPulse iOS Member App to the Apple App Store, triggering the synchronized activation of Sign in with Apple and Twilio Verify / WhatsApp OTP.

---

### [CH-006] Anti-Skimming Desk Cash Control vs. Staff Operational Friction
- **Context & Problem Statement**:
  Despite high digital payment penetration, cash remains a prominent payment method across independent fitness facilities in the GCC (representing 20% to 45% of transactions for day passes, personal training packages, and front-desk supplement sales). Reception desk cash operations present a massive fraud surface: dishonest staff pocket physical cash, conceal shortages, and manually alter membership term dates in the software to grant friends unauthorized access. However, enforcing bureaucratic, multi-step financial accounting controls can paralyze front-desk staff during morning and evening rush hours when queues form for towels, check-ins, and renewals.
- **Options Evaluated**:
  - *Option A: Trust-Based Open Register*. Permit staff to accept cash freely without shift boundaries. Reconcile drawer balances ad-hoc on a weekly or monthly basis.
  - *Option B: Total Cashless Policy*. Prohibit cash transactions across the platform, mandating 100% digital payments (POS credit cards, Apple Pay, online payment links).
  - *Option C: Shift-Based Blind Drawer Closeout with Immutable Adjustment Ledgers*. Enforce structured shift lifecycles (Open Shift with float -> Transact -> Close Shift with blind cash entry). Prohibit direct membership date overwrites, routing all manual extensions through an immutable adjustment ledger backed by cryptographic audit logging.
- **Trade-Offs & Failure Modes**:
  - *Option A Failure Mode*: Rampant financial skimming and membership fraud. Without strict shift ownership, missing cash cannot be attributed to specific staff members. Unrecorded date changes grant months of free unearned gym access, destroying gym owner profits and undermining trust in the SaaS platform.
  - *Option B Failure Mode*: Instant commercial resistance. Gym owners lose high-margin cash sales from walk-in visitors, tourists without local SIMs/cards, and members buying energy drinks or day passes. Competitors offering cash handling win the accounts.
- **Chosen Path & Resolution**:
  - GymPulse implemented **Option C: Shift-Based Blind Drawer Reconciliation** (ADR D-8, ADR D-11, ADR D-21):
    - **Mandatory Active Shift**: Cash transactions are physically blocked by the API unless the operating staff member has an open shift record with an initial verified opening float (`POST /v1/shifts/open`).
    - **Blind Drawer Closeout**: Upon shift completion (`POST /v1/shifts/:id/close`), the cashier must submit counted cash *without* the software revealing expected totals. The backend calculates `expected_cash = opening_float + cash_sales`, computes the discrepancy in integer fils, and transitions the shift to `variance_pending` if the variance exceeds the gym's configured tolerance threshold.
    - **Segregation of Duties**: The staff member who opened or closed the shift is strictly prohibited from approving their own drawer variance (`SELF_APPROVAL_PROHIBITED`). A manager or owner must inspect the variance report and approve or flag the discrepancy.
    - **Immutable Date Adjustment Ledger**: Direct edits to `memberships.end_date` are strictly forbidden at the database and application levels. Any manual date modification requires inserting a row into `membership_adjustments` detailing exact days added, category (complimentary vs. staff error), authorizing staff ID, and reason note.
    - **Automated Surveillance**: `GET /v1/reports/anomalies` synthesizes shift cash variances, complimentary extensions, voided payments, and manual check-in overrides into a unified risk scoring profile per staff member, backed by SHA-256 tamper-evident audit logs.
- **Future Revisit Trigger**:
  - Enterprise rollouts requiring integration with automated smart cash drawers (e.g., Cashlogy / Glory automated cash recyclers) that count physical notes electronically via hardware APIs.

---

### [CH-007] Multi-Region Payment Strategy (GCC vs. India vs. International)
- **Context & Problem Statement**:
  GymPulse’s commercial target market spans three distinct financial ecosystems: the United Arab Emirates / GCC, India, and international territories. A naive architectural assumption is to standardize globally on a single payment gateway (such as Stripe Connect). In practice, regional payment economics render this assumption non-viable:
  1. **GCC Market**: Domestic debit networks—specifically Saudi Arabia’s **mada** and the UAE’s **Jaywan**—dominate point-of-sale and online transactions. Furthermore, regional Buy Now Pay Later (BNPL) providers (**Tabby** and **Tamara**) represent up to 35% of annual gym membership sales due to high ticket sizes ($800–$2,500/year). Standard international Stripe does not offer optimal interchange routing for mada or native checkout support for Tabby/Tamara.
  2. **India Market**: Stripe operates on an invite-only basis with severe regulatory restrictions imposed by the Reserve Bank of India (RBI) on recurring card storage and auto-debit e-Mandates. India's digital economy is dominated by the **Unified Payments Interface (UPI)**, which commands over 75% of digital retail transactions.
- **Options Evaluated**:
  - *Option A: Monolithic Global Stripe Connect*. Force Stripe Connect across all regions, accepting suboptimal local scheme processing, high interchange fees, and exclusion from the Indian market.
  - *Option B: Unstructured Per-Tenant Gateway Configuration*. Allow gym owners to input arbitrary API keys for any local payment gateway into an unconstrained JSON configuration column in the database.
  - *Option C: Factory-Pattern Multi-Provider Architecture with Master Platform Vaults*. Implement an abstract payment provider factory (`PaymentProviderFactory`) that dynamically routes transactions to dedicated regional adapters (**Tap Payments** for GCC, **Razorpay Route** for India, **Stripe Connect** for International), while isolating credentials in platform-level secret vaults.
- **Trade-Offs & Failure Modes**:
  - *Option A Failure Mode*: Commercial failure in the GCC and total inability to launch in India. GCC gym owners reject platforms that cannot process mada debit cards at domestic interchange rates or offer Tabby split-payments for high-tier annual plans. In India, refusing UPI eliminates 8 out of 10 prospective gym members at checkout.
  - *Option B Failure Mode*: Catastrophic security and architectural collapse. Storing raw gateway API keys in tenant database tables creates an untenable attack surface for plaintext credential theft. Furthermore, managing disparate webhook signature verifications, idempotency patterns, and refund state machines in ad-hoc code produces untestable payment pipelines.
- **Chosen Path & Resolution**:
  - GymPulse implemented **Option C: Factory-Pattern Multi-Provider Architecture** (ADR D-6, ADR D-14):
    - **Unified Payment Abstraction**: Defined a standardized `IPaymentProvider` contract enforcing deterministic methods: `createCustomer`, `createCheckoutSession`, `chargeRecurringCard`, `refundTransaction`, and `handleWebhookEvent`.
    - **Dynamic Regional Routing**: `PaymentProviderFactory` instantiates the optimal regional gateway adapter based on `gym.country` and transaction currency:
      - **GCC (AED, SAR, BHD, KWD, OMR, QAR)**: Handled via **Tap Payments**, unlocking native mada, Jaywan, KNET, Benefit, Tabby, and regional Apple Pay.
      - **India (INR)**: Handled via **Razorpay Route**, unlocking UPI deep linking, QR intent, RuPay debit cards, and RBI-compliant recurring e-Mandates.
      - **International (USD, EUR, GBP)**: Routed to **Stripe Connect** for global multi-currency credit card settlement.
    - **Secrets Separation & Vaulting**: The insecure `payment_provider_config` column was completely dropped from the database. Master API keys reside in environment secrets manager (`PlatformSecretsService`). Gyms store only their linked merchant account identifiers (`provider_account_id` in `gym_payment_accounts`). Any interim sensitive credentials are encrypted with AES-256-GCM envelope encryption at rest, accessible strictly by the gym owner, and never exposed via REST API responses.
- **Future Revisit Trigger**:
  - Geographical expansion into Southeast Asia (Singapore, Malaysia, Indonesia) requiring native integration with PayNow, DuitNow, and GrabPay via regional aggregators like Xendit or HitPay.

---

## 🛡️ Document Maintenance & Governance

1. **Immutable Historical Record**: Entries represent deliberate crossroads at specific points in the platform lifecycle. They must never be rewritten or deleted to conceal past mistakes. If a past decision is reversed, append a formal `Reversal Decision Log` referencing the original challenge ID.
2. **Review Cadence**: This document is reviewed quarterly by the Lead Architect and Principal Engineers during Phase Milestone Reviews.
3. **Trigger Execution**: When a `Future Revisit Trigger` condition is satisfied, a formal Architecture Review Ticket must be created referencing the specific `[CH-XXX]` entry prior to modifying production core services.
