import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  char,
  jsonb,
  integer,
  bigint,
  bigserial,
  date,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// 1. Better Auth Tables (Spec Section 5.10 & Decision D-6)
// ============================================================================

export const authUsers = pgTable('auth_user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const authSessions = pgTable('auth_session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
});

export const authAccounts = pgTable('auth_account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const authVerifications = pgTable('auth_verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// 2. Tenancy & Staff Hierarchy (Spec Section 4.1 & 5.1)
// ============================================================================

export const gyms = pgTable('gyms', {
  id: uuid('id').primaryKey().defaultRandom(),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name').notNull(),
  tradeLicenseNumber: text('trade_license_number').notNull(),
  vatRegistered: boolean('vat_registered').notNull().default(false),
  trnNumber: text('trn_number').unique(),
  timezone: text('timezone').notNull().default('Asia/Dubai'),
  currency: char('currency', { length: 3 }).notNull().default('AED'),
  status: text('status')
    .notNull()
    .default('pending_verification')
    .$type<'pending_verification' | 'active' | 'suspended' | 'closed' | 'rejected'>(),
  settings: jsonb('settings').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  address: jsonb('address').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authUserId: text('auth_user_id').references(() => authUsers.id, { onDelete: 'set null' }),
    phone: text('phone'),
    email: text('email'),
    fullName: text('full_name').notNull(),
    nameSearch: text('name_search').notNull(), // normalized for trigram search
    status: text('status').notNull().default('active').$type<'active' | 'disabled'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_auth_user_id_uq').on(table.authUserId).where(sql`${table.authUserId} IS NOT NULL`),
    uniqueIndex('users_email_uq').on(sql`lower(${table.email})`).where(sql`${table.email} IS NOT NULL`),
    uniqueIndex('users_phone_uq').on(table.phone).where(sql`${table.phone} IS NOT NULL`),
  ],
);

export const staffAssignments = pgTable(
  'staff_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    role: text('role')
      .notNull()
      .$type<'owner' | 'manager' | 'front_desk'>(),
    branchScope: text('branch_scope')
      .notNull()
      .default('all')
      .$type<'all' | 'selected'>(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('staff_gym_user_uq').on(table.gymId, table.userId),
  ],
);

export const staffBranchAccess = pgTable(
  'staff_branch_access',
  {
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    staffAssignmentId: uuid('staff_assignment_id')
      .notNull()
      .references(() => staffAssignments.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.staffAssignmentId, table.branchId] }),
  ],
);

export const platformAdmins = pgTable('platform_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'restrict' }),
  role: text('role')
    .notNull()
    .default('superadmin')
    .$type<'superadmin' | 'support' | 'auditor'>(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    memberNumber: text('member_number').notNull(),
    homeBranchId: uuid('home_branch_id').references(() => branches.id, { onDelete: 'set null' }),
    gender: text('gender'),
    dateOfBirth: date('date_of_birth'),
    emergencyContact: jsonb('emergency_contact'),
    status: text('status').notNull().default('active').$type<'active' | 'archived'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('members_gym_user_uq').on(table.gymId, table.userId),
    uniqueIndex('members_gym_number_uq').on(table.gymId, table.memberNumber),
  ],
);

// Platform Admin Users (GymPulse Staff - Spec Section 4.5)
export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: text('role')
    .notNull()
    .$type<'support' | 'finance' | 'compliance' | 'engineering' | 'super_admin'>(),
  status: text('status').notNull().default('active').$type<'active' | 'disabled'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const impersonationSessions = pgTable('impersonation_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id')
    .notNull()
    .references(() => adminUsers.id),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id),
  targetUserId: uuid('target_user_id')
    .notNull()
    .references(() => users.id),
  reason: text('reason').notNull(),
  ticketRef: text('ticket_ref'),
  mode: text('mode').notNull().default('read_only').$type<'read_only' | 'elevated'>(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export const gymFeatureFlags = pgTable(
  'gym_feature_flags',
  {
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id),
    flag: text('flag').notNull(),
    enabled: boolean('enabled').notNull(),
    limits: jsonb('limits').notNull().default({}),
    updatedBy: uuid('updated_by').references(() => adminUsers.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.gymId, table.flag] }),
  ],
);

// ============================================================================
// 3. Plans & Freeze Policies (Spec Section 5.2)
// ============================================================================

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  durationUnit: text('duration_unit').notNull().$type<'day' | 'month'>(),
  durationValue: integer('duration_value').notNull(),
  priceMinor: bigint('price_minor', { mode: 'number' }).notNull(),
  currency: char('currency', { length: 3 }).notNull().default('AED'),
  priceIncludesVat: boolean('price_includes_vat').notNull().default(true),
  graceDays: integer('grace_days').notNull().default(0),
  branchAccess: text('branch_access')
    .notNull()
    .default('home_only')
    .$type<'home_only' | 'all_branches'>(),
  accessSchedule: jsonb('access_schedule'),
  isActive: boolean('is_active').notNull().default(true),
});

export const freezePolicies = pgTable(
  'freeze_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'restrict' }),
    planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }), // null = gym master default
    isEnabled: boolean('is_enabled').notNull().default(true),
    maxOccurrences: integer('max_occurrences').notNull().default(2),
    minDays: integer('min_days').notNull().default(7),
    maxTotalDays: integer('max_total_days').notNull().default(30),
    noticeDays: integer('notice_days').notNull().default(2),
    proofMode: text('proof_mode').notNull().default('none').$type<'none' | 'optional' | 'required'>(),
    requireReview: boolean('require_review').notNull().default(false),
    cycleBasis: text('cycle_basis')
      .notNull()
      .default('membership_term')
      .$type<'membership_term' | 'anniversary_year'>(),
    allowRemainingBalance: boolean('allow_remaining_balance').notNull().default(true),
    feeMinor: bigint('fee_minor', { mode: 'number' }).notNull().default(0),
    currency: char('currency', { length: 3 }).notNull().default('AED'),
  },
  (table) => [
    uniqueIndex('freeze_policy_gym_default').on(table.gymId).where(sql`${table.planId} IS NULL`),
    uniqueIndex('freeze_policy_plan').on(table.planId).where(sql`${table.planId} IS NOT NULL`),
  ],
);

// ============================================================================
// 4. Memberships & Date Ledger (Spec Section 5.3 & 5.4)
// ============================================================================

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'restrict' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'restrict' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    status: text('status')
      .notNull()
      .default('active')
      .$type<'pending_payment' | 'active' | 'frozen' | 'expired' | 'cancelled'>(),
    statusBeforeFreeze: text('status_before_freeze'),
    startDate: date('start_date').notNull(),
    originalEndDate: date('original_end_date').notNull(),
    endDate: date('end_date').notNull(), // effective inclusive end date
    planSnapshot: jsonb('plan_snapshot').notNull(),
    cancelEffectiveDate: date('cancel_effective_date'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('memberships_member_idx').on(table.gymId, table.memberId),
    index('memberships_status_end_idx').on(table.gymId, table.status, table.endDate),
  ],
);

export const membershipAdjustments = pgTable(
  'membership_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'restrict' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'restrict' }),
    kind: text('kind')
      .notNull()
      .$type<'purchase' | 'renewal' | 'freeze' | 'freeze_early_lift' | 'complimentary' | 'correction'>(),
    previousEndDate: date('previous_end_date').notNull(),
    newEndDate: date('new_end_date').notNull(),
    freezeId: uuid('freeze_id'),
    paymentId: uuid('payment_id'),
    reason: text('reason'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('adjustment_once_per_freeze')
      .on(table.freezeId, table.kind)
      .where(sql`${table.freezeId} IS NOT NULL`),
  ],
);

export const membershipFreezes = pgTable('membership_freezes', {
  id: uuid('id').primaryKey().defaultRandom(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'restrict' }),
  membershipId: uuid('membership_id')
    .notNull()
    .references(() => memberships.id, { onDelete: 'restrict' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  liftedOn: date('lifted_on'),
  daysCharged: integer('days_charged'),
  status: text('status')
    .notNull()
    .$type<'pending_review' | 'scheduled' | 'active' | 'completed' | 'early_lifted' | 'cancelled' | 'rejected'>(),
  reasonCode: text('reason_code')
    .notNull()
    .$type<'medical' | 'travel' | 'relocation' | 'religious_observance' | 'other'>(),
  reasonNote: text('reason_note'),
  policySnapshot: jsonb('policy_snapshot').notNull(),
  feeMinor: bigint('fee_minor', { mode: 'number' }).notNull().default(0),
  currency: char('currency', { length: 3 }).notNull().default('AED'),
  source: text('source').notNull().$type<'member_app' | 'staff' | 'system'>(),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const freezeProofs = pgTable('freeze_proofs', {
  id: uuid('id').primaryKey().defaultRandom(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'restrict' }),
  freezeId: uuid('freeze_id')
    .notNull()
    .references(() => membershipFreezes.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull().$type<'application/pdf' | 'image/jpeg' | 'image/png'>(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256').notNull(),
  reviewStatus: text('review_status').notNull().default('pending').$type<'pending' | 'verified' | 'rejected'>(),
  deleteAfter: date('delete_after').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gymDocuments = pgTable('gym_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'restrict' }),
  docType: text('doc_type')
    .notNull()
    .$type<'trade_license' | 'trn_certificate' | 'id_card' | 'other'>(),
  fileName: text('file_name').notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 5. Cash, POS & Invoicing (Spec Section 5.5)
// ============================================================================

export const gymPaymentAccounts = pgTable(
  'gym_payment_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'restrict' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    status: text('status')
      .notNull()
      .default('not_started')
      .$type<'not_started' | 'onboarding' | 'restricted' | 'active' | 'disabled'>(),
    currency: char('currency', { length: 3 }).notNull().default('AED'),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    chargesEnabled: boolean('charges_enabled').notNull().default(false),
    payoutsEnabled: boolean('payouts_enabled').notNull().default(false),
    detailsSubmitted: boolean('details_submitted').notNull().default(false),
    requirements: jsonb('requirements').notNull().default({}),
    metadata: jsonb('metadata').notNull().default({}),
    // Interim encrypted credentials (AES-256-GCM envelope encryption): never returned on GET
    encryptedSecrets: jsonb('encrypted_secrets'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('gym_provider_uq').on(table.gymId, table.provider),
    uniqueIndex('provider_account_uq').on(table.provider, table.providerAccountId),
  ],
);

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'restrict' }),
  branchId: uuid('branch_id')
    .notNull()
    .references(() => branches.id, { onDelete: 'restrict' }),
  openedBy: uuid('opened_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  openingFloatMinor: bigint('opening_float_minor', { mode: 'number' }).notNull().default(0),
  currency: char('currency', { length: 3 }).notNull().default('AED'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'restrict' }),
    membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'set null' }),
    shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'set null' }),
    paymentAccountId: uuid('payment_account_id').references(() => gymPaymentAccounts.id, { onDelete: 'set null' }),
    purpose: text('purpose').notNull().$type<'membership' | 'renewal' | 'freeze_fee' | 'other'>(),
    method: text('method')
      .notNull()
      .$type<'cash' | 'card_pos' | 'card_online' | 'apple_pay' | 'google_pay' | 'bank_transfer'>(),
    status: text('status')
      .notNull()
      .default('pending')
      .$type<'pending' | 'succeeded' | 'failed' | 'voided' | 'refunded' | 'partially_refunded'>(),
    currency: char('currency', { length: 3 }).notNull().default('AED'),
    totalMinor: bigint('total_minor', { mode: 'number' }).notNull(),
    baseMinor: bigint('base_minor', { mode: 'number' }).notNull(),
    vatMinor: bigint('vat_minor', { mode: 'number' }).notNull(),
    vatRateBps: integer('vat_rate_bps').notNull().default(500),
    provider: text('provider'),
    providerReference: text('provider_reference'),
    providerFeeMinor: bigint('provider_fee_minor', { mode: 'number' }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    recordedBy: uuid('recorded_by').references(() => users.id, { onDelete: 'set null' }),
    voidReason: text('void_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('payments_provider_ref')
      .on(table.provider, table.providerReference)
      .where(sql`${table.provider} IS NOT NULL`),
  ],
);

export const invoiceCounters = pgTable('invoice_counters', {
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'restrict' }),
  series: text('series').notNull(), // e.g. INV, CN, REC
  nextNumber: bigint('next_number', { mode: 'number' }).notNull().default(1),
}, (table) => [
  primaryKey({ columns: [table.gymId, table.series] }),
]);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'restrict' }),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    docType: text('doc_type')
      .notNull()
      .$type<'tax_invoice' | 'simplified_tax_invoice' | 'credit_note' | 'receipt'>(),
    series: text('series').notNull(),
    number: bigint('number', { mode: 'number' }).notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    issuedOn: date('issued_on').notNull(),
    currency: char('currency', { length: 3 }).notNull().default('AED'),
    originalInvoiceId: uuid('original_invoice_id'),
    supplier: jsonb('supplier').notNull(),
    buyer: jsonb('buyer').notNull(),
    lines: jsonb('lines').notNull(),
    totals: jsonb('totals').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('invoices_gym_series_num_uq').on(table.gymId, table.series, table.number),
  ],
);

// ============================================================================
// 6. Check-Ins, Audit & System Nonces (Spec Section 5.7 & 5.8)
// ============================================================================

export const checkIns = pgTable('check_ins', {
  id: uuid('id').primaryKey().defaultRandom(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'restrict' }),
  branchId: uuid('branch_id')
    .notNull()
    .references(() => branches.id, { onDelete: 'restrict' }),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'set null' }),
  result: text('result').notNull().$type<'allowed' | 'denied' | 'override_allowed'>(),
  denyReason: text('deny_reason'),
  method: text('method').notNull().$type<'qr' | 'desk_search' | 'manual' | 'turnstile'>(),
  deviceId: text('device_id'),
  verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
  overrideReason: text('override_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usedPassTokens = pgTable('used_pass_tokens', {
  jti: uuid('jti').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  gymId: uuid('gym_id').references(() => gyms.id, { onDelete: 'restrict' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  actorRole: text('actor_role'),
  adminActorId: uuid('admin_actor_id').references(() => platformAdmins.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  reasonCode: text('reason_code'),
  payload: jsonb('payload').notNull().default({}),
  ip: text('ip'),
  device: text('device'),
  prevHash: text('prev_hash'),
  rowHash: text('row_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
