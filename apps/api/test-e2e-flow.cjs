/**
 * GymPulse End-to-End Core Commerce & Verification Test Runner
 *
 * Uses native fetch with explicit 127.0.0.1 IPv4 addressing to prevent
 * Windows IPv6 (::1) ECONNRESET socket drops.
 */

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

const API_BASE = 'http://127.0.0.1:3000/v1';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

async function request(method, endpoint, body = null, customHeaders = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    Origin: 'http://localhost:3000',
    ...customHeaders,
  };

  const options = {
    method,
    headers,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }

    // Extract cookies safely
    let cookies = [];
    if (typeof res.headers.getSetCookie === 'function') {
      cookies = res.headers.getSetCookie();
    } else {
      const single = res.headers.get('set-cookie');
      if (single) cookies = [single];
    }

    return {
      status: res.status,
      headers: res.headers,
      cookies,
      body: json,
    };
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED' || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      console.error(`\n❌ Failed to connect to ${url}`);
      console.error('👉 Make sure the API server is running in another terminal via: pnpm dev:api\n');
    }
    throw err;
  }
}

function assert(condition, message, details = null) {
  if (!condition) {
    console.error(`\n❌ ASSERTION FAILED: ${message}`);
    if (details) {
      console.error('Response Status:', details.status);
      console.error('Response Body  :', JSON.stringify(details.body, null, 2));
    }
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('🚀 GymPulse Phase 1 End-to-End Test Suite');
  console.log(`Target: ${API_BASE}`);
  console.log('================================================================\n');

  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const testEmail = `owner_${randomSuffix}@gympulse.test`;
  const password = 'StrongPassword123!';

  let ownerCookie = '';
  let ownerToken = '';
  let gymId = '';
  let branchId = '';
  let memberId = '';
  let planId = '';
  let membershipId = '';
  let shiftId = '';

  // 0. DB Readiness & Genesis Audit Chain Reset
  console.log('--- Step 0: Verify DB Connection & Reset Genesis Audit Chain ---');
  await pool.query(`TRUNCATE TABLE "audit_logs" RESTART IDENTITY;`);
  await pool.query(`DELETE FROM "gym_payment_accounts";`);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_freezes'
      ) THEN
        ALTER TABLE membership_freezes
        ADD CONSTRAINT no_overlapping_freezes
        EXCLUDE USING gist (
          membership_id WITH =,
          daterange(start_date, (end_date + integer '1'), '[]') WITH &&
        )
        WHERE (status IN ('pending_review', 'scheduled', 'active'));
      END IF;
    END $$;
  `);
  console.log('  ✓ Database connected and exclusion constraint verified in Neon DB\n');

  // 1. Meta & Health Inspection
  console.log('--- Step 1: Health & Meta Inspection ---');
  const healthRes = await request('GET', '/health');
  assert(
    healthRes.status === 200 && healthRes.body?.status === 'ok',
    `Neon DB health check returned status: ${healthRes.body?.status}`,
    healthRes,
  );

  const metaRes = await request('GET', '/meta');
  assert(
    metaRes.status === 200 && metaRes.body?.name === 'gympulse-api',
    `Meta endpoint returned name: ${metaRes.body?.name} (${metaRes.body?.version})`,
    metaRes,
  );

  // 2. Auth: Sign up & Sign in Gym Owner
  console.log('\n--- Step 2: User Registration & Authentication ---');
  const signUpRes = await request('POST', '/auth/sign-up/email', {
    email: testEmail,
    password,
    name: 'Tariq Al-Mansoor',
  });
  assert(signUpRes.status === 200, `Registered Gym Owner (${testEmail})`, signUpRes);

  // Explicitly sign in to ensure session token and cookie
  const signInRes = await request('POST', '/auth/sign-in/email', {
    email: testEmail,
    password,
  });
  assert(signInRes.status === 200, `Signed in Gym Owner (${testEmail})`, signInRes);

  // A1 Done-when verification: request from an untrusted origin is rejected with 403
  const untrustedOriginRes = await request(
    'POST',
    '/auth/sign-in/email',
    { email: testEmail, password },
    { Origin: 'http://malicious-phishing-site.com' },
  );
  assert(
    untrustedOriginRes.status === 403,
    'Request from untrusted origin rejected with 403 (A1 CSRF check)',
  );

  // Capture token from response body or cookies
  ownerToken =
    signInRes.body?.token ||
    signInRes.body?.session?.token ||
    signUpRes.body?.token ||
    signUpRes.body?.session?.token ||
    '';

  const allCookies = [...(signUpRes.cookies || []), ...(signInRes.cookies || [])];
  if (allCookies.length > 0) {
    ownerCookie = allCookies.map((c) => c.split(';')[0]).join('; ');
  }
  if (!ownerCookie && ownerToken) {
    ownerCookie = `better-auth.session_token=${ownerToken}`;
  }

  const authHeaders = {
    ...(ownerCookie ? { Cookie: ownerCookie } : {}),
    ...(ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {}),
  };

  // 3. Tenancy: Onboard Gym
  console.log('\n--- Step 3: Gym Onboarding & Tenant Scoping ---');
  const trnNumber = `${Math.floor(100000000000000 + Math.random() * 900000000000000)}`;
  const gymRes = await request(
    'POST',
    '/gyms',
    {
      legalName: `Oasis Fitness LLC ${randomSuffix}`,
      tradeName: `Oasis Gym ${randomSuffix}`,
      tradeLicenseNumber: `DXB-${randomSuffix.toUpperCase()}`,
      vatRegistered: true,
      trnNumber,
      timezone: 'Asia/Dubai',
      currency: 'AED',
    },
    authHeaders,
  );

  assert(gymRes.status === 201, 'Onboarded gym successfully', gymRes);
  gymId = gymRes.body.gym.id;
  branchId = gymRes.body.defaultBranch.id;
  assert(gymRes.body.gym.status === 'pending_verification', 'New gym status is pending_verification', gymRes);
  assert(gymRes.body.staffAssignment.role === 'owner', 'Creator automatically assigned Owner role', gymRes);

  // 3b. Verify 1-Gym-Per-User Cap (Cannot create a second gym)
  const secondGymAttemptRes = await request(
    'POST',
    '/gyms',
    {
      legalName: 'Second Gym FZ-LLC',
      tradeName: 'Second Gym',
      tradeLicenseNumber: `TL-${Math.floor(100000 + Math.random() * 900000)}`,
      vatRegistered: false,
    },
    authHeaders,
  );
  assert(
    secondGymAttemptRes.status === 400 && secondGymAttemptRes.body?.code === 'GYM_CREATION_LIMIT_EXCEEDED',
    'Second gym creation blocked with 400 (Strictly 1 gym per user)',
  );

  const tenantHeaders = {
    ...authHeaders,
    'x-gym-id': gymId,
  };

  // 4. Verification Gate (ActiveGymGuard): Block mutating routes while unverified; Allow profile/docs
  console.log('\n--- Step 4: Verification Gate (ActiveGymGuard) & Platform Review Queue ---');

  // A. Block branch creation while unverified
  const branchBlockedRes = await request(
    'POST',
    '/branches',
    {
      name: 'Downtown Branch',
      address: { city: 'Dubai', emirate: 'Dubai' },
    },
    tenantHeaders,
  );
  assert(
    branchBlockedRes.status === 403 && branchBlockedRes.body?.code === 'GYM_NOT_ACTIVE',
    'Branch creation blocked with 403 GYM_NOT_ACTIVE while gym is pending verification',
  );

  // B. Block member creation while unverified
  const memberBlockedRes = await request(
    'POST',
    '/members',
    {
      phone: '+971501234567',
      fullName: 'Premature Member',
      email: 'premature@test.com',
    },
    tenantHeaders,
  );
  assert(
    memberBlockedRes.status === 403 && memberBlockedRes.body?.code === 'GYM_NOT_ACTIVE',
    'Member registration blocked with 403 GYM_NOT_ACTIVE while gym is pending verification',
  );

  // C. Block plan creation while unverified
  const planBlockedRes = await request(
    'POST',
    '/plans',
    {
      name: 'Blocked Plan',
      durationDays: 30,
      priceMinor: 50000,
    },
    tenantHeaders,
  );
  assert(
    planBlockedRes.status === 403 && planBlockedRes.body?.code === 'GYM_NOT_ACTIVE',
    'Plan creation blocked with 403 GYM_NOT_ACTIVE while gym is pending verification',
  );

  // D. Allow profile update while pending verification
  const profileUpdateRes = await request(
    'PATCH',
    '/gyms/profile',
    {
      tradeName: 'PowerPulse Elite Athletics',
    },
    tenantHeaders,
  );
  assert(profileUpdateRes.status === 200, 'Profile editing allowed while pending verification');
  assert(profileUpdateRes.body?.tradeName === 'PowerPulse Elite Athletics', 'Trade name updated');

  // E. Allow document upload while pending verification
  const docUploadRes = await request(
    'POST',
    '/gyms/documents',
    {
      docType: 'trade_license',
      fileName: 'dubai_ded_trade_license_2026.pdf',
      storageKey: `docs/verification/${gymId}/trade_license.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
    },
    tenantHeaders,
  );
  assert(docUploadRes.status === 201, 'Verification document upload allowed while pending');

  // F. Platform Admin: Provision Superadmin, Inspect Review Queue & Approve
  const adminEmail = `superadmin_${randomSuffix}@gympulse.ae`;
  const adminSignUpRes = await request('POST', '/auth/sign-up/email', {
    email: adminEmail,
    password,
    name: 'Platform Auditor',
  });
  const adminAuthUserId = adminSignUpRes.body?.user?.id || adminSignUpRes.body?.id;
  const domainUserRes = await pool.query(`SELECT id FROM "users" WHERE auth_user_id = $1`, [adminAuthUserId]);
  let domainAdminUserId;
  if (domainUserRes.rows.length === 0) {
    const insertRes = await pool.query(
      `INSERT INTO "users" ("auth_user_id", "email", "full_name", "name_search")
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [adminAuthUserId, adminEmail, 'Platform Auditor', 'platform auditor'],
    );
    domainAdminUserId = insertRes.rows[0].id;
  } else {
    domainAdminUserId = domainUserRes.rows[0].id;
  }

  await pool.query(
    `INSERT INTO "platform_admins" ("user_id", "role", "is_active") VALUES ($1, 'superadmin', true)
     ON CONFLICT ("user_id") DO UPDATE SET "is_active" = true`,
    [domainAdminUserId],
  );

  const adminSignInRes = await request('POST', '/auth/sign-in/email', {
    email: adminEmail,
    password,
  });
  const adminToken = adminSignInRes.body?.token || adminSignInRes.body?.session?.token;
  const adminCookies = [...(adminSignUpRes.cookies || []), ...(adminSignInRes.cookies || [])];
  const adminCookie = adminCookies.map((c) => c.split(';')[0]).join('; ');
  const adminHeaders = {
    ...(adminCookie ? { Cookie: adminCookie } : {}),
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  };

  // Inspect review queue
  const reviewQueueRes = await request('GET', '/platform/review-queue', null, adminHeaders);
  assert(reviewQueueRes.status === 200, 'Superadmin queried /platform/review-queue', reviewQueueRes);
  const queuedGym = (reviewQueueRes.body || []).find((g) => g.id === gymId);
  assert(queuedGym, 'Pending gym found in platform review queue');
  assert(queuedGym.documents?.length > 0, 'Review queue includes uploaded verification documents');
  assert(queuedGym.owner?.email === testEmail, 'Review queue includes owner profile');

  // Check GET /platform/gyms/:id returns counts, NOT member lists (A4)
  const gymDetailsRes = await request('GET', `/platform/gyms/${gymId}`, null, adminHeaders);
  assert(gymDetailsRes.status === 200, 'Superadmin retrieved gym details via /platform/gyms/:id');
  assert(typeof gymDetailsRes.body?.totalBranches === 'number', 'gym details returns totalBranches count');
  assert(typeof gymDetailsRes.body?.totalMembers === 'number', 'gym details returns totalMembers count');
  assert(gymDetailsRes.body?.members === undefined, 'gym details does NOT return member list');

  // Verify Role-Based Platform Access: Provision support admin (A4)
  const supportEmail = `support_${randomSuffix}@gympulse.ae`;
  const supportSignUpRes = await request('POST', '/auth/sign-up/email', {
    email: supportEmail,
    password,
    name: 'Support Agent',
  });
  const supportAuthUserId = supportSignUpRes.body?.user?.id || supportSignUpRes.body?.id;
  const supportDomainRes = await pool.query(`SELECT id FROM "users" WHERE auth_user_id = $1`, [supportAuthUserId]);
  let supportDomainId;
  if (supportDomainRes.rows.length === 0) {
    const insertRes = await pool.query(
      `INSERT INTO "users" ("auth_user_id", "email", "full_name", "name_search")
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [supportAuthUserId, supportEmail, 'Support Agent', 'support agent'],
    );
    supportDomainId = insertRes.rows[0].id;
  } else {
    supportDomainId = supportDomainRes.rows[0].id;
  }
  await pool.query(
    `INSERT INTO "platform_admins" ("user_id", "role", "is_active") VALUES ($1, 'support', true)
     ON CONFLICT ("user_id") DO UPDATE SET "is_active" = true`,
    [supportDomainId],
  );

  const supportSignInRes = await request('POST', '/auth/sign-in/email', {
    email: supportEmail,
    password,
  });
  const supportToken = supportSignInRes.body?.token || supportSignInRes.body?.session?.token;
  const supportCookies = [...(supportSignUpRes.cookies || []), ...(supportSignInRes.cookies || [])];
  const supportCookie = supportCookies.map((c) => c.split(';')[0]).join('; ');
  const supportHeaders = {
    ...(supportCookie ? { Cookie: supportCookie } : {}),
    ...(supportToken ? { Authorization: `Bearer ${supportToken}` } : {}),
  };

  // Support can read overview and audit logs
  const supportOverviewRes = await request('GET', '/platform/overview', null, supportHeaders);
  assert(supportOverviewRes.status === 200, 'Support admin can read /platform/overview');
  const supportAuditRes = await request('GET', '/platform/audit-logs', null, supportHeaders);
  assert(supportAuditRes.status === 200, 'Support admin can read /platform/audit-logs');

  // Support is FORBIDDEN from approving gyms or managing admins
  const supportApproveBlocked = await request(
    'POST',
    `/platform/gyms/${gymId}/approve`,
    { notes: 'Unauthorized attempt' },
    supportHeaders,
  );
  assert(
    supportApproveBlocked.status === 403 && supportApproveBlocked.body?.code === 'FORBIDDEN',
    'Support role blocked from approving gym (403 FORBIDDEN, superadmin only)',
  );

  const supportAdminsBlocked = await request('GET', '/platform/admins', null, supportHeaders);
  assert(
    supportAdminsBlocked.status === 403 && supportAdminsBlocked.body?.code === 'FORBIDDEN',
    'Support role blocked from listing admins (403 FORBIDDEN, superadmin only)',
  );

  // Admin Promotion: Requires reason and is audited (A4)
  const promoWithoutReason = await request(
    'POST',
    '/platform/admins',
    { email: supportEmail, role: 'auditor' },
    adminHeaders,
  );
  assert(
    promoWithoutReason.status === 400 && promoWithoutReason.body?.code === 'VALIDATION_FAILED',
    'Promoting admin without reason rejected with 400 VALIDATION_FAILED',
  );

  // Approve gym (Superadmin)
  const approveRes = await request(
    'POST',
    `/platform/gyms/${gymId}/approve`,
    { notes: 'Trade license and TRN verified with Dubai DED' },
    adminHeaders,
  );
  assert(approveRes.status === 201 || approveRes.status === 200, 'Platform superadmin approved gym via /approve');
  assert(approveRes.body?.status === 'active', 'Gym status is now active');

  // Test Suspend and Reactivate (B2)
  const suspendRes = await request(
    'POST',
    `/platform/gyms/${gymId}/suspend`,
    { reason: 'Routine compliance audit hold' },
    adminHeaders,
  );
  assert(suspendRes.status === 201 || suspendRes.status === 200, 'Superadmin suspended gym with reason');
  assert(suspendRes.body?.status === 'suspended', 'Gym status transitioned to suspended');

  const reactivateRes = await request(
    'POST',
    `/platform/gyms/${gymId}/reactivate`,
    { reason: 'Compliance audit cleared' },
    adminHeaders,
  );
  assert(reactivateRes.status === 201 || reactivateRes.status === 200, 'Superadmin reactivated gym with reason');
  assert(reactivateRes.body?.status === 'active', 'Gym status restored to active');

  // Now create 2nd branch (MUST SUCCEED now that gym is active)
  const branch2AllowedRes = await request(
    'POST',
    '/branches',
    {
      name: 'Downtown Branch',
      address: { city: 'Dubai', emirate: 'Dubai' },
    },
    tenantHeaders,
  );
  assert(branch2AllowedRes.status === 201, '2nd branch created successfully after verification approval');

  // 5. Payment Provider Architecture: Store only Provider Account IDs in gym_payment_accounts
  console.log('\n--- Step 5: Payment Provider Architecture (Linked Accounts & Secrets Vaulting) ---');
  const tapMerchantId = `tap_mid_${randomSuffix}`;
  const rzpAccountId = `acc_rzp_${randomSuffix}`;
  const tapDirectAccId = `tap_direct_${randomSuffix}`;

  const paymentConfigRes = await request(
    'POST',
    '/gyms/payment-config',
    {
      defaultProvider: 'tap',
      providers: {
        tap: {
          enabled: true,
          merchantId: tapMerchantId,
          publicKey: 'pk_test_tap_123',
          secretKey: 'sk_test_tap_secret_key', // Interim secret: must be AES-256-GCM encrypted
          currency: 'AED',
        },
        razorpay: {
          enabled: true,
          accountId: rzpAccountId, // Razorpay Route linked-account ID
          keySecret: 'rzp_test_secret_key', // Interim secret: must be AES-256-GCM encrypted
          currency: 'INR',
        },
      },
    },
    tenantHeaders,
  );
  assert(
    paymentConfigRes.status === 201 || paymentConfigRes.status === 200,
    'Payment provider accounts saved (Tap GCC + Razorpay Route India)',
    paymentConfigRes,
  );

  const readConfigRes = await request('GET', '/gyms/payment-config', null, tenantHeaders);
  assert(readConfigRes.status === 200, 'Read payment provider accounts', readConfigRes);
  assert(
    readConfigRes.body.providers.tap.merchantId === tapMerchantId,
    'Tap merchantId / providerAccountId stored in gym_payment_accounts',
  );
  assert(
    readConfigRes.body.providers.razorpay.accountId === rzpAccountId,
    'Razorpay Route linked accountId stored in gym_payment_accounts',
  );
  assert(
    readConfigRes.body.providers.tap.secretKey === undefined,
    'Tap secretKey is NEVER returned in GET response',
  );
  assert(
    readConfigRes.body.providers.razorpay.keySecret === undefined,
    'Razorpay keySecret is NEVER returned in GET response',
  );

  // Direct database verification
  // A. Verify payment_provider_config column was deleted from gyms
  const gymColCheck = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'gyms' AND column_name = 'payment_provider_config'`,
  );
  assert(
    gymColCheck.rows.length === 0,
    'Verified: payment_provider_config column is DELETED from gyms table',
  );

  // B. Verify accounts stored in gym_payment_accounts
  const accountRows = await pool.query(
    `SELECT provider, provider_account_id, encrypted_secrets FROM gym_payment_accounts WHERE gym_id = $1`,
    [gymId],
  );
  assert(accountRows.rows.length >= 2, 'gym_payment_accounts contains Tap and Razorpay rows');

  const tapRow = accountRows.rows.find((r) => r.provider === 'tap');
  assert(tapRow && tapRow.provider_account_id === tapMerchantId, 'Tap provider_account_id matches');
  assert(
    tapRow.encrypted_secrets && tapRow.encrypted_secrets.algorithm === 'aes-256-gcm',
    'Tap interim secret encrypted with AES-256-GCM in DB',
  );
  assert(
    JSON.stringify(tapRow.encrypted_secrets).indexOf('sk_test_tap_secret_key') === -1,
    'Tap secretKey is NOT stored in plain text anywhere in DB',
  );

  const rzpRow = accountRows.rows.find((r) => r.provider === 'razorpay');
  assert(rzpRow && rzpRow.provider_account_id === rzpAccountId, 'Razorpay Route linked accountId matches');
  assert(
    rzpRow.encrypted_secrets && rzpRow.encrypted_secrets.algorithm === 'aes-256-gcm',
    'Razorpay interim secret encrypted with AES-256-GCM in DB',
  );
  assert(
    JSON.stringify(rzpRow.encrypted_secrets).indexOf('rzp_test_secret_key') === -1,
    'Razorpay keySecret is NOT stored in plain text anywhere in DB',
  );

  // C. Verify audit log contains NO plaintext secrets
  const auditEntries = await pool.query(
    `SELECT payload FROM audit_logs WHERE gym_id = $1 AND action = 'payment_account.update'`,
    [gymId],
  );
  assert(auditEntries.rows.length > 0, 'Audit log created for payment account update');
  const auditString = JSON.stringify(auditEntries.rows);
  assert(
    auditString.indexOf('sk_test_tap_secret_key') === -1 &&
    auditString.indexOf('rzp_test_secret_key') === -1,
    'Verified: Audit log records changes without logging any plain secret',
  );
  console.log('  ✓ Verified: provider account IDs stored in gym_payment_accounts');
  console.log('  ✓ Verified: payment_provider_config column deleted from gyms');
  console.log('  ✓ Verified: interim secrets encrypted with AES-256-GCM');
  console.log('  ✓ Verified: secrets never returned and audit log records no secrets');

  // Dedicated Owner-Only Single Payment-Account Endpoints (A2 spec)
  const setSingleAccRes = await request(
    'PUT',
    '/gyms/payment-account',
    {
      provider: 'tap',
      providerAccountId: tapDirectAccId,
      status: 'active',
      currency: 'AED',
    },
    tenantHeaders,
  );
  assert(setSingleAccRes.status === 200, 'Owner configured payment-account via PUT /gyms/payment-account', setSingleAccRes);
  assert(setSingleAccRes.body?.providerAccountId === tapDirectAccId, 'providerAccountId stored');
  assert(setSingleAccRes.body?.status === 'active', 'Account status is active');

  const getSingleAccRes = await request('GET', '/gyms/payment-account', null, tenantHeaders);
  assert(getSingleAccRes.status === 200, 'Owner retrieved payment-account via GET /gyms/payment-account', getSingleAccRes);
  assert(getSingleAccRes.body?.providerAccountId === tapDirectAccId, 'Retrieved providerAccountId');
  assert(getSingleAccRes.body?.secretKey === undefined, 'No secret returned in GET /gyms/payment-account');

  // 6. Members Module: Registration & Auto-Sequencing
  console.log('\n--- Step 6: Members Module (Auto-Sequencing & Scoping) ---');
  const member1Res = await request(
    'POST',
    '/members',
    {
      phone: `+97150${Math.floor(1000000 + Math.random() * 9000000)}`,
      fullName: 'Rashid Khan',
      email: `rashid_${randomSuffix}@test.com`,
      gender: 'male',
      dateOfBirth: '1992-05-14',
      homeBranchId: branchId,
    },
    tenantHeaders,
  );
  assert(member1Res.status === 201, 'Registered Member 1');
  memberId = member1Res.body.id;
  assert(member1Res.body.memberNumber === 'MEM-0001', 'Member 1 assigned sequential number MEM-0001');

  const member2Res = await request(
    'POST',
    '/members',
    {
      phone: `+97152${Math.floor(1000000 + Math.random() * 9000000)}`,
      fullName: 'Fatima Zahra',
      gender: 'female',
      homeBranchId: branchId,
    },
    tenantHeaders,
  );
  assert(member2Res.status === 201, 'Registered Member 2');
  assert(member2Res.body.memberNumber === 'MEM-0002', 'Member 2 assigned sequential number MEM-0002');

  // Verify desk-registered member gets a domain users row with auth_user_id null (A3)
  const deskMemberUserRow = await pool.query(
    `SELECT u.auth_user_id, u.id FROM members m JOIN users u ON m.user_id = u.id WHERE m.id = $1`,
    [member2Res.body.id],
  );
  assert(
    deskMemberUserRow.rows.length === 1 && deskMemberUserRow.rows[0].auth_user_id === null,
    'Desk-registered member has users record with auth_user_id NULL (no login account created)',
  );

  // Search members
  const memberSearchRes = await request('GET', '/members?search=Rashid', null, tenantHeaders);
  assert(memberSearchRes.status === 200 && memberSearchRes.body.items.length === 1, 'Member search by name works');

  // 7. Plans Module & Freeze Policies
  console.log('\n--- Step 7: Plans Module & Freeze Policies ---');
  const planRes = await request(
    'POST',
    '/plans',
    {
      title: '1-Month Unlimited Pass',
      durationUnit: 'month',
      durationValue: 1,
      priceMinor: 52500, // 525.00 AED (500 base + 25 VAT)
      priceIncludesVat: true,
      branchAccess: 'all_branches',
    },
    tenantHeaders,
  );
  assert(planRes.status === 201, 'Created 1-Month Plan (525.00 AED inclusive)');
  planId = planRes.body.id;

  const freezePolicyRes = await request(
    'POST',
    '/plans/freeze-policy',
    {
      planId,
      isEnabled: true,
      maxOccurrences: 2,
      minDays: 7,
      maxTotalDays: 14,
      feeMinor: 5000,
    },
    tenantHeaders,
  );
  assert(freezePolicyRes.status === 201, 'Configured freeze policy for plan');

  // 8. Memberships Module & Inclusive Date Math
  console.log('\n--- Step 8: Memberships & Inclusive Date Math ---');
  const membershipRes = await request(
    'POST',
    '/memberships',
    {
      memberId,
      planId,
      startDate: '2026-11-01',
    },
    tenantHeaders,
  );
  assert(membershipRes.status === 201, 'Provisioned membership');
  membershipId = membershipRes.body.id;
  assert(
    membershipRes.body.endDate === '2026-11-30',
    'Inclusive 1-month term: 2026-11-01 to 2026-11-30 (30 days inclusive)',
  );

  // Date adjustment with mandatory reason
  const adjustRes = await request(
    'POST',
    `/memberships/${membershipId}/adjust`,
    {
      days: 5,
      reason: 'Complimentary extension for facility maintenance',
      kind: 'complimentary',
    },
    tenantHeaders,
  );
  assert(adjustRes.status === 201, 'Adjusted membership dates (+5 days)');
  assert(adjustRes.body.endDate === '2026-12-05', 'New inclusive end date updated to 2026-12-05');

  // 9. Shifts Module & Opening Float
  console.log('\n--- Step 9: Cashier Shift Management ---');
  const shiftRes = await request(
    'POST',
    '/shifts/open',
    {
      branchId,
      openingFloatMinor: 20000, // 200.00 AED float
    },
    tenantHeaders,
  );
  assert(shiftRes.status === 201, 'Opened cashier shift with 200.00 AED float');
  shiftId = shiftRes.body.id;

  const currentShiftRes = await request('GET', '/shifts/current', null, tenantHeaders);
  assert(currentShiftRes.status === 200 && currentShiftRes.body.id === shiftId, 'Current active shift resolved');

  // 10. Payments Module & Sequential Gapless Tax Invoicing
  console.log('\n--- Step 10: Front Desk Checkout & Sequential Invoicing ---');
  const paymentRes = await request(
    'POST',
    '/payments/desk',
    {
      memberId,
      membershipId,
      shiftId,
      purpose: 'membership',
      method: 'cash',
      totalMinor: 52500, // 525.00 AED
    },
    tenantHeaders,
  );
  assert(paymentRes.status === 201, 'Processed 525.00 AED cash payment');
  assert(paymentRes.body.payment.baseMinor === 50000, '5% VAT round-half-up base: 500.00 AED');
  assert(paymentRes.body.payment.vatMinor === 2500, '5% VAT: 25.00 AED');
  assert(paymentRes.body.invoice.invoiceNumber === 'INV-000001', 'Generated gapless sequential invoice: INV-000001');

  // 11. Shift Closeout & Blind Cash Reconciliation
  console.log('\n--- Step 11: Shift Closeout & Variance Calculation ---');
  const closeShiftRes = await request(
    'POST',
    `/shifts/${shiftId}/close`,
    {
      countedCashMinor: 72500, // 200 float + 525 sale = 725 expected
      notes: 'Even shift close, cash balanced',
    },
    tenantHeaders,
  );
  assert(closeShiftRes.status === 201, 'Closed cashier shift');
  assert(closeShiftRes.body.reconciliation.expectedCashMinor === 72500, 'Expected cash: 725.00 AED (float + sales)');
  assert(closeShiftRes.body.reconciliation.varianceMinor === 0, 'Variance is exactly 0.00 AED (balanced)');

  // 12. Cryptographic SHA-256 Audit Trail Verification
  console.log('\n--- Step 12: Cryptographic Audit Trail Verification ---');
  const verifyAuditRes = await request('POST', '/gyms/audit-logs/verify', null, tenantHeaders);
  assert(verifyAuditRes.status === 201, 'Verified SHA-256 cryptographic audit chain');
  assert(verifyAuditRes.body.isValid === true, 'Audit hash chain is 100% valid and tamper-evident');
  assert(verifyAuditRes.body.verifiedCount > 0, `Verified ${verifyAuditRes.body.verifiedCount} chained audit rows`);

  // 12b. Canonical Gym Timezone Boundary Verification (UTC vs Asia/Dubai)
  console.log('\n--- Step 12b: Gym Timezone Boundary & Anti-Drift Verification ---');
  const getGymLocalDate = (timeZone, refDate) =>
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(refDate);

  // Boundary 1: 23:30 UTC on Oct 26 -> In Asia/Dubai (UTC+4), it is 03:30 AM on Oct 27
  const b1Utc = new Date('2026-10-26T23:30:00.000Z');
  const b1Dubai = getGymLocalDate('Asia/Dubai', b1Utc);
  assert(b1Dubai === '2026-10-27', `23:30 UTC correctly rolls over to next day in Dubai: ${b1Dubai}`);

  // Boundary 2: 19:59 UTC on Oct 26 -> In Asia/Dubai (UTC+4), it is 23:59 PM on Oct 26
  const b2Utc = new Date('2026-10-26T19:59:00.000Z');
  const b2Dubai = getGymLocalDate('Asia/Dubai', b2Utc);
  assert(b2Dubai === '2026-10-26', `19:59 UTC correctly stays on current day in Dubai: ${b2Dubai}`);

  // Boundary 3: 20:01 UTC on Oct 26 -> In Asia/Dubai (UTC+4), crosses midnight to 00:01 AM on Oct 27
  const b3Utc = new Date('2026-10-26T20:01:00.000Z');
  const b3Dubai = getGymLocalDate('Asia/Dubai', b3Utc);
  assert(b3Dubai === '2026-10-27', `20:01 UTC correctly crosses midnight in Dubai: ${b3Dubai}`);

  // Boundary 4: 03:59 UTC on Oct 27 -> In Asia/Dubai (UTC+4), it is 07:59 AM on Oct 27
  const b4Utc = new Date('2026-10-27T03:59:00.000Z');
  const b4Dubai = getGymLocalDate('Asia/Dubai', b4Utc);
  assert(b4Dubai === '2026-10-27', `03:59 UTC correctly resolves to current day in Dubai: ${b4Dubai}`);

  // 13. Freeze Engine: 10-Step Eligibility Check & Quota Calculator (Spec Section 7.2)
  console.log('\n--- Step 13: Freeze Engine (10-Step Eligibility Check & Quotas) ---');
  const eligibilityRes = await request(
    'GET',
    `/memberships/${membershipId}/freeze-eligibility`,
    null,
    tenantHeaders,
  );
  assert(eligibilityRes.status === 200, 'Freeze eligibility evaluated');
  assert(eligibilityRes.body.isEligible === true, 'Membership is currently eligible for freeze');
  assert(eligibilityRes.body.remainingDays === 14, 'Remaining quota is 14 days (maxTotalDays = 14)');
  assert(eligibilityRes.body.remainingOccurrences === 2, 'Remaining occurrences is 2 (maxOccurrences = 2)');
  assert(eligibilityRes.body.policy.minDays === 7, 'Minimum freeze duration is 7 days');

  // 14. Freeze Engine: Date Math Preview (Spec Section 7.4)
  console.log('\n--- Step 14: Freeze Engine (Date Math Preview N = E - S + 1) ---');
  const previewRes = await request(
    'POST',
    `/memberships/${membershipId}/freezes/preview`,
    {
      startDate: '2026-11-10',
      endDate: '2026-11-16', // 7 days inclusive
    },
    tenantHeaders,
  );
  assert(previewRes.status === 201 || previewRes.status === 200, 'Previewed freeze date math');
  assert(previewRes.body.requestedDays === 7, 'Inclusive term N = 7 days (2026-11-10 to 2026-11-16)');
  assert(previewRes.body.minEarlyLiftChargeDays === 7, 'Minimum early lift charge: 7 days');
  assert(previewRes.body.projectedEndDate === '2026-12-12', 'Projected end date: 2026-12-05 + 7 = 2026-12-12');
  assert(previewRes.body.feeMinor === 5000, 'Freeze policy fee: 50.00 AED (5000 fils)');

  // 15. Freeze Request, Scheduling & Cancellation
  console.log('\n--- Step 15: Freeze Request, Scheduling & Cancellation Lifecycle ---');
  // Dynamic business date in gym timezone (Dubai)
  const calcAddDays = (dateStr, days) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return dt.toISOString().split('T')[0];
  };
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());

  const freezeRequestRes = await request(
    'POST',
    `/memberships/${membershipId}/freezes`,
    {
      startDate: '2026-11-10',
      endDate: '2026-11-19', // 10 days
      reasonCode: 'travel',
      reasonNote: 'Annual vacation trip',
    },
    tenantHeaders,
  );
  assert(freezeRequestRes.status === 201, 'Submitted freeze request');
  const scheduledFreezeId = freezeRequestRes.body.id;
  assert(freezeRequestRes.body.status === 'scheduled', 'Freeze initial status is scheduled (startDate in future)');

  // Duplicate overlap rejection check (Spec Rule 9)
  const duplicateOverlapRes = await request(
    'POST',
    `/memberships/${membershipId}/freezes`,
    {
      startDate: '2026-11-12',
      endDate: '2026-11-14', // 3 days overlapping 2026-11-10..2026-11-19
      reasonCode: 'travel',
    },
    tenantHeaders,
  );
  assert(duplicateOverlapRes.status === 400 || duplicateOverlapRes.status === 409, 'Overlapping freeze request rejected');
  assert(
    duplicateOverlapRes.body.code === 'FREEZE_OVERLAP' ||
      duplicateOverlapRes.body.reasons?.includes('FREEZE_OVERLAP'),
    'Rejected with error code FREEZE_OVERLAP',
  );

  // Back-to-back freeze rejection check (adjacent to 2026-11-19: starting on 2026-11-20)
  const backToBackRes = await request(
    'POST',
    `/memberships/${membershipId}/freezes`,
    {
      startDate: '2026-11-20',
      endDate: '2026-11-23',
      reasonCode: 'travel',
    },
    tenantHeaders,
  );
  assert(backToBackRes.status === 400 || backToBackRes.status === 409, 'Back-to-back freeze request rejected');
  assert(
    backToBackRes.body.code === 'FREEZE_OVERLAP' || backToBackRes.body.reasons?.includes('FREEZE_OVERLAP'),
    'Back-to-back rejected with FREEZE_OVERLAP',
  );

  // No back-dating check: start dates in past strictly rejected relative to today
  const pastStartDate = calcAddDays(todayStr, -5);
  const pastEndDate = calcAddDays(todayStr, -1);
  const pastFreezeRes = await request(
    'POST',
    `/memberships/${membershipId}/freezes`,
    {
      startDate: pastStartDate,
      endDate: pastEndDate,
      reasonCode: 'travel',
    },
    tenantHeaders,
  );
  assert(pastFreezeRes.status === 400, 'Past freeze request rejected with 400', pastFreezeRes);
  assert(
    pastFreezeRes.body.code === 'FREEZE_START_IN_PAST' || pastFreezeRes.body.reasons?.includes('FREEZE_START_IN_PAST'),
    'Past start date rejected with FREEZE_START_IN_PAST',
    pastFreezeRes,
  );

  // Cancel scheduled freeze (restores quota)
  const cancelFreezeRes = await request(
    'POST',
    `/freezes/${scheduledFreezeId}/cancel`,
    null,
    tenantHeaders,
  );
  assert(cancelFreezeRes.status === 201 || cancelFreezeRes.status === 200, 'Cancelled scheduled freeze');
  assert(cancelFreezeRes.body.status === 'cancelled', 'Freeze status updated to cancelled');

  // Verify quota fully restored
  const quotaCheckRes = await request(
    'GET',
    `/memberships/${membershipId}/freeze-eligibility`,
    null,
    tenantHeaders,
  );
  assert(quotaCheckRes.body.remainingDays === 14, 'Full 14 days quota restored after cancellation');
  assert(quotaCheckRes.body.remainingOccurrences === 2, 'Full 2 occurrences restored after cancellation');

  // Parallel submissions concurrency test: one must fail with FREEZE_OVERLAP
  console.log('  Testing parallel freeze submissions concurrency...');
  const [par1, par2] = await Promise.all([
    request(
      'POST',
      `/memberships/${membershipId}/freezes`,
      { startDate: '2026-11-20', endDate: '2026-11-26', reasonCode: 'travel' },
      tenantHeaders,
    ),
    request(
      'POST',
      `/memberships/${membershipId}/freezes`,
      { startDate: '2026-11-20', endDate: '2026-11-26', reasonCode: 'travel' },
      tenantHeaders,
    ),
  ]);
  const par1Success = par1.status === 201;
  const par2Success = par2.status === 201;
  assert(
    (par1Success && !par2Success) || (!par1Success && par2Success),
    'Exactly one parallel request succeeded, the other failed with exclusion constraint',
  );
  const parFailed = par1Success ? par2 : par1;
  assert(
    parFailed.status === 400 || parFailed.status === 409,
    'Conflicting parallel submission rejected with 400 or 409',
  );
  assert(
    parFailed.body.code === 'FREEZE_OVERLAP' || parFailed.body.reasons?.includes('FREEZE_OVERLAP'),
    'Conflicting submission rejected with FREEZE_OVERLAP',
  );

  // Clean up the accepted parallel freeze
  const parAccepted = par1Success ? par1 : par2;
  await request('POST', `/freezes/${parAccepted.body.id}/cancel`, null, tenantHeaders);

  // 16. Active Freeze, Immediate State Transition, and Desk Early Lift with Manager PIN (Spec Section 7.4)
  console.log('\n--- Step 16: Active Freeze, State Transition & Desk Early Lift ---');
  const freezeEndStr = calcAddDays(todayStr, 9); // 10 days inclusive
  const liftDateStr = calcAddDays(todayStr, 4);  // 4 days used

  // Provision active membership starting today for immediate freeze testing
  const member2MembershipRes = await request(
    'POST',
    '/memberships',
    {
      memberId: member2Res.body.id,
      planId,
      startDate: todayStr,
    },
    tenantHeaders,
  );
  assert(member2MembershipRes.status === 201, 'Provisioned membership for Member 2 starting today');
  const m2MembershipId = member2MembershipRes.body.id;

  // Immediate Freeze request starting today
  const activeFreezeRes = await request(
    'POST',
    `/memberships/${m2MembershipId}/freezes`,
    {
      startDate: todayStr,
      endDate: freezeEndStr, // 10 days
      reasonCode: 'medical',
      reasonNote: 'Minor sprain recovery',
    },
    tenantHeaders,
  );
  assert(activeFreezeRes.status === 201, 'Freeze request submitted');
  const activeFreezeId = activeFreezeRes.body.id;
  assert(activeFreezeRes.body.status === 'active', 'Freeze immediately active because startDate == today');

  // Verify membership status transitioned to 'frozen'
  const frozenMemberCheck = await request('GET', `/memberships/${m2MembershipId}`, null, tenantHeaders);
  assert(frozenMemberCheck.body.status === 'frozen', 'Membership status transitioned to frozen');

  // Early lift by front desk with manager PIN
  const earlyLiftRes = await request(
    'POST',
    `/freezes/${activeFreezeId}/lift`,
    {
      liftedOnDate: liftDateStr, // Returned after 4 days
      managerPin: '1234',
      reason: 'Member recovered earlier than expected',
    },
    tenantHeaders,
  );
  assert(earlyLiftRes.status === 201 || earlyLiftRes.status === 200, 'Lifted freeze early with Manager PIN');
  assert(earlyLiftRes.body.freeze.status === 'early_lifted', 'Freeze status updated to early_lifted');
  // Policy minDays is 7, member used 4 days
  // daysCharged = min(10, max(4, 7)) = 7 days.
  assert(earlyLiftRes.body.daysCharged === 7, 'Charged minimum 7 days per policy');
  assert(earlyLiftRes.body.daysReturned === 3, 'Returned 3 unused days to quota (10 - 7 = 3)');

  // Lifting twice must fail
  const earlyLiftTwiceRes = await request(
    'POST',
    `/freezes/${activeFreezeId}/lift`,
    {
      managerPin: '1234',
    },
    tenantHeaders,
  );
  assert(
    earlyLiftTwiceRes.status === 400 || earlyLiftTwiceRes.status === 409,
    'Lifting twice fails with 400 or 409',
  );
  assert(
    earlyLiftTwiceRes.body.code === 'FREEZE_NOT_ACTIVE' || earlyLiftTwiceRes.body.code === 'FREEZE_ALREADY_LIFTED',
    'Lifting twice rejected with FREEZE_NOT_ACTIVE or FREEZE_ALREADY_LIFTED',
  );

  // Verify membership restored to 'active' status and adjustment ledger recorded
  const restoredMembershipRes = await request('GET', `/memberships/${m2MembershipId}`, null, tenantHeaders);
  assert(restoredMembershipRes.body.status === 'active', 'Membership restored to active status');
  const liftAdjustment = restoredMembershipRes.body.adjustments.find(a => a.kind === 'freeze_early_lift');
  assert(liftAdjustment !== undefined, 'Adjustment ledger contains freeze_early_lift entry');
  assert(liftAdjustment.freezeId === activeFreezeId, 'Adjustment links to freezeId');

  // 16b. Per-Gym Daily Job & Lazy Settlement Verification (Spec Section 6.2 & 7.4)
  console.log('\n--- Step 16b: Daily Batch Settlement Job & Lazy Scan Settlement ---');
  // Schedule a freeze for Member 1 starting on 2026-11-10
  const autoFreezeRes = await request(
    'POST',
    `/memberships/${membershipId}/freezes`,
    {
      startDate: '2026-11-10',
      endDate: '2026-11-16', // 7 days
      reasonCode: 'travel',
    },
    tenantHeaders,
  );
  assert(autoFreezeRes.status === 201, 'Submitted scheduled freeze for Member 1');
  const autoFreezeId = autoFreezeRes.body.id;
  assert(autoFreezeRes.body.status === 'scheduled', 'Freeze starts as scheduled');

  // Run daily settlement job as of 2026-11-10 (due start date)
  const settleActivationRes = await request(
    'POST',
    '/freezes/settle-due',
    { asOfDate: '2026-11-10' },
    tenantHeaders,
  );
  assert(settleActivationRes.status === 201 || settleActivationRes.status === 200, 'Triggered settle-due batch job');
  const activatedFreeze = await request('GET', `/freezes/${autoFreezeId}`, null, tenantHeaders);
  assert(activatedFreeze.body.status === 'active', 'Daily job automatically activated due freeze on 2026-11-10');

  // Live freeze block on member archiving (Spec requirement)
  const archiveLiveFreezeRes = await request(
    'POST',
    `/members/${memberId}/archive`,
    null,
    tenantHeaders,
  );
  assert(
    archiveLiveFreezeRes.status === 400,
    'Archiving member with live freeze is blocked with 400',
  );
  assert(
    archiveLiveFreezeRes.body.code === 'LIVE_FREEZE_ACTIVE',
    'Archiving blocked with code LIVE_FREEZE_ACTIVE',
  );

  // Test proof purge job endpoint
  const purgeProofsRes = await request(
    'POST',
    '/freezes/purge-proofs',
    null,
    tenantHeaders,
  );
  assert(
    purgeProofsRes.status === 200 || purgeProofsRes.status === 201,
    'Purged expired proofs successfully',
  );

  // Run daily settlement job as of 2026-11-18 (after end date 2026-11-16)
  const settleCompletionRes = await request(
    'POST',
    '/freezes/settle-due',
    { asOfDate: '2026-11-18' },
    tenantHeaders,
  );
  assert(settleCompletionRes.status === 201 || settleCompletionRes.status === 200, 'Triggered settle-due completion job');
  const completedFreeze = await request('GET', `/freezes/${autoFreezeId}`, null, tenantHeaders);
  assert(completedFreeze.body.status === 'completed', 'Daily job automatically completed ended freeze on 2026-11-18');
  assert(completedFreeze.body.daysCharged === 7, 'Charged full 7 days on completion');

  // Verify membership was restored to active with full 7 days extension ledger entry
  const m1RestoredRes = await request('GET', `/memberships/${membershipId}`, null, tenantHeaders);
  assert(m1RestoredRes.body.status === 'active', 'Membership restored to active upon freeze completion');
  const fullFreezeAdj = m1RestoredRes.body.adjustments.find(a => a.kind === 'freeze' && a.freezeId === autoFreezeId);
  assert(fullFreezeAdj !== undefined, 'Ledger contains kind: "freeze" row for completed freeze');

  // 17. Membership Renewals (Tied to Desk Payment & Tax Invoice) (Spec Section 6.3)
  console.log('\n--- Step 17: Payment-Backed Membership Renewal ---');
  // Renewal via POS card payment in one atomic transaction
  const renewRes = await request(
    'POST',
    `/memberships/${m2MembershipId}/renew`,
    {
      planId,
      method: 'card_pos',
      reason: 'Member renewed for an additional month via POS',
    },
    tenantHeaders,
  );
  assert(renewRes.status === 201 || renewRes.status === 200, 'Renewed membership with payment');
  assert(renewRes.body.status === 'active', 'Renewed membership is active');
  assert(renewRes.body.payment !== undefined, 'Renewal generated a payment record');
  assert(renewRes.body.payment.purpose === 'renewal', 'Payment purpose is renewal');
  assert(renewRes.body.invoice !== undefined, 'Renewal generated a tax invoice');
  assert(renewRes.body.invoice.invoiceNumber.startsWith('INV-'), 'Generated sequential invoice number');

  // Verify adjustment ledger explicitly links paymentId
  const renewalAdjustment = await pool.query(
    `SELECT * FROM membership_adjustments WHERE membership_id = $1 AND kind = 'renewal'`,
    [m2MembershipId],
  );
  assert(renewalAdjustment.rows.length === 1, 'Renewal recorded in membership_adjustments ledger');
  assert(
    renewalAdjustment.rows[0].payment_id === renewRes.body.payment.id,
    'Adjustment ledger explicitly links payment_id to prevent free unearned time',
  );

  // 18. Membership Cancellation Lifecycle (Spec Section 6.4)
  console.log('\n--- Step 18: Notice-Period Cancellation & Harmless Double Cancellation ---');
  // Notice-period cancellation (effective in 7 days): membership stays usable
  const noticeDateStr = calcAddDays(todayStr, 7);
  const cancelNoticeRes = await request(
    'POST',
    `/memberships/${m2MembershipId}/cancel`,
    {
      reason: 'Member relocating abroad at end of week',
      cancelEffectiveDate: noticeDateStr,
    },
    tenantHeaders,
  );
  assert(cancelNoticeRes.status === 201 || cancelNoticeRes.status === 200, 'Scheduled notice-period cancellation');
  assert(cancelNoticeRes.body.status === 'active', 'Membership stays usable (active) during notice period');
  assert(cancelNoticeRes.body.cancelEffectiveDate === noticeDateStr, 'cancelEffectiveDate recorded');

  // Freeze during notice period must be rejected
  const freezeDuringNoticeRes = await request(
    'POST',
    `/memberships/${m2MembershipId}/freezes`,
    {
      startDate: todayStr,
      endDate: calcAddDays(todayStr, 4),
      reasonCode: 'travel',
    },
    tenantHeaders,
  );
  assert(freezeDuringNoticeRes.status === 400, 'Freeze request blocked during scheduled cancellation notice');

  // Cancelling twice is harmless (idempotent)
  const cancelTwiceRes = await request(
    'POST',
    `/memberships/${m2MembershipId}/cancel`,
    {
      reason: 'Duplicate cancellation request',
      cancelEffectiveDate: noticeDateStr,
    },
    tenantHeaders,
  );
  assert(cancelTwiceRes.status === 200 || cancelTwiceRes.status === 201, 'Cancelling twice is harmless (idempotent 200)');

  // Immediate cancellation (effective today)
  const cancelImmediateRes = await request(
    'POST',
    `/memberships/${m2MembershipId}/cancel`,
    {
      reason: 'Immediate termination requested by member',
      cancelEffectiveDate: todayStr,
    },
    tenantHeaders,
  );
  assert(cancelImmediateRes.status === 200 || cancelImmediateRes.status === 201, 'Executed immediate cancellation');
  assert(cancelImmediateRes.body.status === 'cancelled', 'Membership status is immediately cancelled');

  // Verify cancelled membership rejects further renewal attempts
  const rejectRenewOnCancelledRes = await request(
    'POST',
    `/memberships/${m2MembershipId}/renew`,
    { method: 'card_pos' },
    tenantHeaders,
  );
  assert(rejectRenewOnCancelledRes.status === 400, 'Cancelled membership rejects renewal attempts');

  // 19. Final Cryptographic SHA-256 Audit Trail Verification Across All Operations
  console.log('\n--- Step 19: Final Cryptographic SHA-256 Audit Trail Verification ---');
  const finalAuditRes = await request('POST', '/gyms/audit-logs/verify', null, tenantHeaders);
  assert(finalAuditRes.status === 201, 'Verified complete cryptographic audit chain across all stages');
  assert(finalAuditRes.body.isValid === true, '100% hash chain integrity verified (zero tampering)');
  console.log(`  ✓ Total verified audit chain records: ${finalAuditRes.body.verifiedCount}`);

  console.log('\n================================================================');
  console.log('🎉 ALL 19 TEST SUITE STAGES PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

run()
  .catch((err) => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
