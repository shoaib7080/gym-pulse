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
  // Safety guard: refuse to run unless ALLOW_DESTRUCTIVE_TESTS=true and NODE_ENV is not production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ E2E test suite cannot run in production mode!');
    process.exit(1);
  }
  if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
    console.error('❌ Safety guard: ALLOW_DESTRUCTIVE_TESTS=true must be set to run e2e integration tests.');
    process.exit(1);
  }

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

  // 0. DB Readiness & Schema Constraint Assertion (No runtime DDL)
  console.log('--- Step 0: Verify DB Connection & Schema Constraint Assertion ---');
  const constraintCheck = await pool.query(
    `SELECT conname FROM pg_constraint WHERE conname = 'no_overlapping_freezes'`,
  );
  assert(
    constraintCheck.rows.length > 0,
    'Verified database schema contains no_overlapping_freezes exclusion constraint (applied via migration)',
  );
  console.log('  ✓ Database connected and migration constraints verified in Neon DB\n');

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
  console.log('\n--- Step 11: Shift Closeout, Variance Approval & Anomaly Reports ---');
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
  assert(closeShiftRes.body.reconciliation.status === 'closed', 'Shift status is closed');

  // Milestone 4: Provision a manager to test variance sign-off & segregation of duties
  const managerEmail = `manager_${randomSuffix}@gympulse.test`;
  const managerSignUpRes = await request('POST', '/auth/sign-up/email', {
    email: managerEmail,
    password,
    name: 'Zayd Al-Manager',
  });
  assert(managerSignUpRes.status === 200, 'Registered manager user');

  const managerSignInRes = await request('POST', '/auth/sign-in/email', {
    email: managerEmail,
    password,
  });
  const managerAllCookies = [...(managerSignUpRes.cookies || []), ...(managerSignInRes.cookies || [])];
  let managerCookie = '';
  if (managerAllCookies.length > 0) {
    managerCookie = managerAllCookies.map((c) => c.split(';')[0]).join('; ');
  }
  const managerToken =
    managerSignInRes.body?.token ||
    managerSignInRes.body?.session?.token ||
    managerSignUpRes.body?.token ||
    managerSignUpRes.body?.session?.token ||
    '';
  if (!managerCookie && managerToken) {
    managerCookie = `better-auth.session_token=${managerToken}`;
  }
  const managerHeaders = {
    ...(managerCookie ? { Cookie: managerCookie } : {}),
    ...(managerToken ? { Authorization: `Bearer ${managerToken}` } : {}),
    'x-gym-id': gymId,
  };

  const assignManagerRes = await request(
    'POST',
    '/gyms/staff',
    {
      email: managerEmail,
      role: 'manager',
      branchScope: 'all',
    },
    tenantHeaders,
  );
  assert(
    assignManagerRes.status === 201 || assignManagerRes.status === 200,
    `Assigned manager staff role (Status: ${assignManagerRes.status}, Body: ${JSON.stringify(assignManagerRes.body)})`,
  );

  // Open Shift 2 to test cash drawer variance & approval workflow
  const shift2Res = await request(
    'POST',
    '/shifts/open',
    {
      branchId,
      openingFloatMinor: 10000, // 100.00 AED float
    },
    tenantHeaders,
  );
  assert(shift2Res.status === 201, 'Opened shift 2 with 100.00 AED float');
  const shift2Id = shift2Res.body.id;

  // Close Shift 2 with shortage: counted 80.00 AED vs 100.00 expected (-20.00 AED variance)
  const closeShift2Res = await request(
    'POST',
    `/shifts/${shift2Id}/close`,
    {
      countedCashMinor: 8000,
      notes: 'Shortage detected: 20 AED missing from drawer float',
    },
    tenantHeaders,
  );
  assert(closeShift2Res.status === 201, 'Closed shift 2');
  assert(closeShift2Res.body.reconciliation.varianceMinor === -2000, 'Recorded variance of -20.00 AED');
  assert(closeShift2Res.body.reconciliation.requiresApproval === true, 'Shift requires manager approval');
  assert(closeShift2Res.body.reconciliation.status === 'variance_pending', 'Shift status is variance_pending');

  // Cashier self-approval must be rejected (Segregation of Duties)
  const selfApproveRes = await request(
    'POST',
    `/shifts/${shift2Id}/approve`,
    { notes: 'Attempting self approval' },
    tenantHeaders,
  );
  assert(selfApproveRes.status === 400, 'Self-approval rejected with 400');
  assert(selfApproveRes.body.code === 'SELF_APPROVAL_PROHIBITED', 'Blocked with SELF_APPROVAL_PROHIBITED');

  // Manager approves shift variance with justification
  const managerApproveRes = await request(
    'POST',
    `/shifts/${shift2Id}/approve`,
    { notes: 'Shortage of 20 AED investigated and approved under reserve tolerance' },
    managerHeaders,
  );
  assert(
    managerApproveRes.status === 200 || managerApproveRes.status === 201,
    'Manager approved shift variance',
    managerApproveRes,
  );
  assert(managerApproveRes.body.shift.status === 'approved', 'Shift status updated to approved');

  // Verify Anomaly Audit Reports endpoint (Spec Section 8 & Milestone 4)
  const anomalyReportRes = await request('GET', '/reports/anomalies', null, tenantHeaders);
  assert(anomalyReportRes.status === 200, 'Retrieved cash control & anomaly report');
  assert(anomalyReportRes.body.summary.totalShiftsWithVariance >= 1, 'Report includes shifts with variance');
  assert(anomalyReportRes.body.summary.totalComplimentaryExtensions >= 1, 'Report includes complimentary extensions');
  assert(anomalyReportRes.body.staffBreakdown.length >= 1, 'Report includes staff anomaly breakdown');
  const varianceDetail = anomalyReportRes.body.details.shiftVariances.find(s => s.shiftId === shift2Id);
  assert(varianceDetail !== undefined, 'Report details list includes Shift 2');
  assert(varianceDetail.varianceMinor === -2000, 'Recorded correct variance in fils (-2000)');

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
    `Conflicting parallel submission rejected with 400 or 409 (Got status: ${parFailed.status}, Body: ${JSON.stringify(parFailed.body)})`,
  );
  assert(
    parFailed.body.code === 'FREEZE_OVERLAP' || parFailed.body.reasons?.includes('FREEZE_OVERLAP'),
    `Conflicting submission rejected with FREEZE_OVERLAP (Got: ${JSON.stringify(parFailed.body)})`,
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

  // Attendance tap while frozen must be rejected (Spec Section 6.2)
  const frozenAttendanceRes = await request(
    'POST',
    '/attendance/tap',
    { membershipId: m2MembershipId },
    tenantHeaders,
  );
  assert(frozenAttendanceRes.status === 400, 'Attendance tap blocked while frozen');
  assert(frozenAttendanceRes.body.code === 'MEMBERSHIP_FROZEN', 'Blocked with code MEMBERSHIP_FROZEN');

  const selfTapFrozenRes = await request(
    'POST',
    '/access/self-tap',
    { membershipId: m2MembershipId },
    tenantHeaders,
  );
  assert(selfTapFrozenRes.status === 400, 'Self-tap blocked while frozen');
  assert(selfTapFrozenRes.body.code === 'FREEZE_ACTIVE', 'Blocked with RFC 7807 code FREEZE_ACTIVE');

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

  // Attendance tap while active succeeds (Tap-to-mark attendance from app)
  const activeAttendanceRes = await request(
    'POST',
    '/attendance/tap',
    { membershipId: m2MembershipId },
    tenantHeaders,
  );
  assert(activeAttendanceRes.status === 201 || activeAttendanceRes.status === 200, 'Attendance tap marked successfully');
  assert(activeAttendanceRes.body.result === 'allowed', 'Attendance check-in allowed');
  assert(activeAttendanceRes.body.checkIn.memberId === member2Res.body.id, 'Recorded correct memberId in check-in');

  // Verify attendance history
  const historyRes = await request(
    'GET',
    `/attendance/history?memberId=${member2Res.body.id}`,
    null,
    tenantHeaders,
  );
  assert(historyRes.status === 200, 'Fetched attendance history');
  assert(historyRes.body.total >= 1, 'History contains recorded check-ins');

  // Ingress Adapter Test: Temporary Stopgap Self-Tap (POST /v1/access/self-tap)
  console.log('  Testing temporary stopgap self-tap attendance logger...');
  const member3Res = await request(
    'POST',
    '/members',
    {
      fullName: 'TapUser Member',
      phone: `+97150888${Math.floor(1000 + Math.random() * 9000)}`,
      email: `tapper_${Date.now()}@test.ae`,
      gender: 'female',
    },
    tenantHeaders,
  );
  assert(member3Res.status === 201, 'Registered Member 3 for Self-Tap verification', member3Res);

  const member3SubRes = await request(
    'POST',
    '/memberships',
    {
      memberId: member3Res.body.id,
      planId,
      startDate: todayStr,
    },
    tenantHeaders,
  );
  assert(member3SubRes.status === 201, 'Provisioned membership for Member 3 starting today');
  const m3MembershipId = member3SubRes.body.id;

  const selfTapRes = await request(
    'POST',
    '/access/self-tap',
    { membershipId: m3MembershipId },
    tenantHeaders,
  );
  assert(selfTapRes.status === 200 || selfTapRes.status === 201, 'Self-tap recorded visit successfully', selfTapRes);
  assert(selfTapRes.body.result === 'allowed', 'Self-tap marked result allowed');
  assert(selfTapRes.body.method === 'self_tap_temporary', 'Method tagged strictly as self_tap_temporary');
  assert(selfTapRes.body.checkIn.verifiedBy === null, 'verified_by is NULL for honor-system in-app tap');
  assert(selfTapRes.body.streak.message === 'Visit Logged for Today', 'Returned client streak semantics');

  // Cooldown Anti-Spam Check: second tap within window must return HTTP 429
  const cooldownRes = await request(
    'POST',
    '/access/self-tap',
    { membershipId: m3MembershipId },
    tenantHeaders,
  );
  assert(cooldownRes.status === 429, 'Duplicate tap within cooldown window rejected with HTTP 429', cooldownRes);
  assert(cooldownRes.body.code === 'SELF_CHECKIN_COOLDOWN_ACTIVE', 'Rejected with SELF_CHECKIN_COOLDOWN_ACTIVE');

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

  // 19. Cryptographic Audit Trail Verification Mid-Point
  console.log('\n--- Step 19: Cryptographic Audit Trail Verification Mid-Point ---');
  const midAuditRes = await request('POST', '/gyms/audit-logs/verify', null, tenantHeaders);
  assert(midAuditRes.status === 201, 'Verified cryptographic audit chain integrity at mid-point');
  assert(midAuditRes.body.isValid === true, '100% hash chain integrity verified');

  // 20. Platform Superadmin Setup & SaaS Plans Discovery
  console.log('\n--- Step 20: Platform Superadmin Setup & SaaS Plans Discovery ---');
  const saasPlansRes = await request('GET', '/platform/saas-plans', null, adminHeaders);
  assert(saasPlansRes.status === 200, 'Superadmin retrieved SaaS plans');
  assert(Array.isArray(saasPlansRes.body) && saasPlansRes.body.length >= 3, 'Default plans (Starter, Growth, Enterprise) exist');
  const starterPlan = saasPlansRes.body.find((p) => p.code === 'starter');
  const growthPlan = saasPlansRes.body.find((p) => p.code === 'growth');
  assert(starterPlan && growthPlan, 'Starter and Growth plans identified');

  // 21. Subscription Provisioning & Gapless Sequential Platform Tax Invoicing
  console.log('\n--- Step 21: Subscription Provisioning & Gapless Sequential Platform Tax Invoicing ---');
  const provisionRes = await request(
    'POST',
    '/platform/subscriptions',
    {
      gymId,
      saasPlanId: growthPlan.id,
      billingMethod: 'bank_transfer',
      startDate: todayStr,
    },
    adminHeaders,
  );
  assert(provisionRes.status === 201, 'Provisioned Growth SaaS plan for tenant gym');
  assert(provisionRes.body.subscription.status === 'active', 'Subscription is active');
  assert(provisionRes.body.invoice.series === 'GP-INV', 'Platform invoice series is GP-INV');
  assert(provisionRes.body.invoice.invoiceNumber.startsWith('GP-INV-'), 'Platform invoice number is GP-INV-000001');
  assert(provisionRes.body.invoice.supplier.trn === '100987654300003', 'Supplier TRN matches GymPulse UAE legal identity');
  assert(provisionRes.body.invoice.totals.grandTotalMinor === 83895, '5% UAE VAT calculated: 79900 + 3995 = 83895 fils');
  const growthInvoiceId = provisionRes.body.invoice.id;

  // Tenant retrieves subscription and invoice status
  const tenantSubRes = await request('GET', '/subscription', null, tenantHeaders);
  assert(tenantSubRes.status === 200, 'Tenant retrieved subscription details');
  assert(tenantSubRes.body.plan.code === 'growth', 'Tenant plan is Growth');
  assert(tenantSubRes.body.isRestricted === false && tenantSubRes.body.isSuspended === false, 'Tenant is not restricted');
  assert(tenantSubRes.body.limits.maxMembers === 500, 'Growth plan member limit is 500');

  const tenantInvoicesRes = await request('GET', '/subscription/invoices', null, tenantHeaders);
  assert(tenantInvoicesRes.status === 200, 'Tenant retrieved platform invoices');
  assert(tenantInvoicesRes.body.length >= 1, 'Platform invoice visible to tenant');
  assert(tenantInvoicesRes.body[0].isPaid === false, 'Invoice is initially unpaid');

  // 22. Unsubscribed Gym Member Cap Enforcement (Spec 4.2)
  console.log('\n--- Step 22: Unsubscribed Gym Member Cap Enforcement (Max 10 Members) ---');
  const unsubSuffix = Math.random().toString(36).substring(2, 7);
  const unsubEmail = `owner2_${unsubSuffix}@gympulse.test`;
  const unsubSignUpRes = await request('POST', '/auth/sign-up/email', {
    name: 'Unsubscribed Gym Owner',
    email: unsubEmail,
    password: 'StrongPassword123!',
  });
  assert(unsubSignUpRes.status === 200 || unsubSignUpRes.status === 201, 'Signed up owner for unsubscribed gym', unsubSignUpRes);

  const unsubSignInRes = await request('POST', '/auth/sign-in/email', {
    email: unsubEmail,
    password: 'StrongPassword123!',
  });
  assert(unsubSignInRes.status === 200, 'Signed in owner for unsubscribed gym', unsubSignInRes);

  const unsubToken = unsubSignInRes.body?.token || unsubSignInRes.body?.session?.token;
  const unsubCookies = [...(unsubSignUpRes.cookies || []), ...(unsubSignInRes.cookies || [])];
  const unsubCookie = unsubCookies.map((c) => c.split(';')[0]).join('; ');
  const unsubAuthHeaders = {
    ...(unsubCookie ? { Cookie: unsubCookie } : {}),
    ...(unsubToken ? { Authorization: `Bearer ${unsubToken}` } : {}),
  };

  const unsubCreateGymRes = await request(
    'POST',
    '/gyms',
    {
      legalName: `Unsubscribed Gym LLC ${unsubSuffix}`,
      tradeName: `Unsubscribed Fitness ${unsubSuffix}`,
      tradeLicenseNumber: `DXB-UNSUB-${unsubSuffix.toUpperCase()}`,
      vatRegistered: false,
      timezone: 'Asia/Dubai',
      currency: 'AED',
    },
    unsubAuthHeaders,
  );
  assert(unsubCreateGymRes.status === 201, 'Created unsubscribed gym', unsubCreateGymRes);
  const unsubGymId = unsubCreateGymRes.body.gym.id;
  await pool.query(`UPDATE "gyms" SET "status" = 'active' WHERE "id" = $1;`, [unsubGymId]);
  const unsubTenantHeaders = {
    ...unsubAuthHeaders,
    'x-gym-id': unsubGymId,
  };

  // Register 10 members in the unsubscribed gym
  for (let i = 1; i <= 10; i++) {
    const regRes = await request(
      'POST',
      '/members',
      {
        fullName: `UnsubMember ${i}`,
        phone: `+9715800${String(i).padStart(2, '0')}${Math.floor(100 + Math.random() * 900)}`,
        email: `unsub${i}_${unsubSuffix}@test.ae`,
        gender: 'male',
      },
      unsubTenantHeaders,
    );
    assert(regRes.status === 201, `Registered member ${i}/10 in unsubscribed gym`, regRes);
  }

  // 11th member must be rejected with 403 MEMBER_LIMIT_UNSUBSCRIBED
  const eleventhMemberRes = await request(
    'POST',
    '/members',
    {
      fullName: 'Eleventh Member',
      phone: `+971580001099`,
      email: `eleventh_${unsubSuffix}@test.ae`,
      gender: 'male',
    },
    unsubTenantHeaders,
  );
  assert(eleventhMemberRes.status === 403, '11th member rejected with 403 Forbidden', eleventhMemberRes);
  assert(eleventhMemberRes.body.code === 'MEMBER_LIMIT_UNSUBSCRIBED', 'Rejected with code MEMBER_LIMIT_UNSUBSCRIBED');

  // 23. Dunning Engine State Transitions & Restriction Lifting
  console.log('\n--- Step 23: Dunning Engine State Transitions & Restriction Lifting ---');
  // Set dueOn for growth invoice to 15 days in the past
  const pastDueStr = calcAddDays(todayStr, -15);
  await pool.query(
    `UPDATE "platform_invoices" SET "due_on" = $1 WHERE "id" = $2;`,
    [pastDueStr, growthInvoiceId],
  );

  // Run dunning sweep
  const sweepRes = await request('POST', '/platform/subscriptions/sweep', { asOfDate: todayStr }, adminHeaders);
  assert(sweepRes.status === 201, 'Executed dunning engine sweep');
  assert(sweepRes.body.restrictedCount >= 1, 'Subscription transitioned to restricted (+14 days overdue)');

  // Verify tenant operations are restricted
  const blockedRegRes = await request(
    'POST',
    '/members',
    {
      fullName: 'Blocked Member',
      phone: `+971507771122`,
      gender: 'female',
    },
    tenantHeaders,
  );
  assert(blockedRegRes.status === 403, 'New member registration blocked under restricted status', blockedRegRes);
  assert(blockedRegRes.body.code === 'SUBSCRIPTION_RESTRICTED', 'Returns SUBSCRIPTION_RESTRICTED');

  const blockedFreezeRes = await request(
    'POST',
    `/memberships/${membershipId}/freezes`,
    {
      startDate: todayStr,
      endDate: calcAddDays(todayStr, 3),
      reasonCode: 'medical',
    },
    tenantHeaders,
  );
  assert(blockedFreezeRes.status === 403, 'Freeze creation blocked under restricted status');
  assert(blockedFreezeRes.body.code === 'SUBSCRIPTION_RESTRICTED', 'Returns SUBSCRIPTION_RESTRICTED');

  // Superadmin records payment for invoice: lifts restrictions immediately!
  const payInvoiceRes = await request(
    'POST',
    `/platform/invoices/${growthInvoiceId}/payments`,
    {
      method: 'bank_transfer',
      amountMinor: 83895,
      receivedOn: todayStr,
      reference: 'TXN-BANK-12345',
    },
    adminHeaders,
  );
  assert(payInvoiceRes.status === 201, 'Recorded platform invoice payment', payInvoiceRes);
  assert(payInvoiceRes.body.isPaid === true, 'Platform invoice marked as fully paid', payInvoiceRes);
  assert(payInvoiceRes.body.restrictionLifted === true, 'Subscription restriction lifted immediately upon payment', payInvoiceRes);

  // Verify tenant subscription is restored to active
  const restoredSubRes = await request('GET', '/subscription', null, tenantHeaders);
  assert(restoredSubRes.status === 200, 'Tenant fetched subscription');
  assert(restoredSubRes.body.subscription.status === 'active', 'Subscription status restored to active');
  assert(restoredSubRes.body.isRestricted === false, 'Tenant restriction flag cleared');

  // 24. Dunning Engine Suspension (+30 Days Overdue) & Check-In Block
  console.log('\n--- Step 24: Dunning Engine Suspension (+30 Days Overdue) & Check-In Block ---');
  // Provision subscription for unsubGymId to test suspension
  const thirtyFiveDaysAgo = calcAddDays(todayStr, -35);
  const subToSuspendRes = await request(
    'POST',
    '/platform/subscriptions',
    {
      gymId: unsubGymId,
      saasPlanId: starterPlan.id,
      startDate: calcAddDays(todayStr, -60),
      dueDays: 0,
    },
    adminHeaders,
  );
  assert(subToSuspendRes.status === 201, 'Provisioned subscription for suspension test');
  await pool.query(
    `UPDATE "platform_invoices" SET "due_on" = $1 WHERE "id" = $2;`,
    [thirtyFiveDaysAgo, subToSuspendRes.body.invoice.id],
  );

  const suspendSweepRes = await request('POST', '/platform/subscriptions/sweep', { asOfDate: todayStr }, adminHeaders);
  assert(suspendSweepRes.status === 201, 'Executed sweep for suspension');
  assert(suspendSweepRes.body.suspendedCount >= 1, 'Subscription transitioned to suspended (+30 days overdue)');

  // Attempt check-in on suspended gym: must be rejected with 403 SUBSCRIPTION_SUSPENDED
  const suspendedCheckInRes = await request(
    'POST',
    '/access/self-tap',
    {
      gymId: unsubGymId,
      memberId: '00000000-0000-0000-0000-000000000001',
      membershipId: '00000000-0000-0000-0000-000000000002',
    },
    unsubTenantHeaders,
  );
  assert(suspendedCheckInRes.status === 403, 'Check-in blocked for suspended gym');
  assert(suspendedCheckInRes.body.code === 'SUBSCRIPTION_SUSPENDED', 'Returns SUBSCRIPTION_SUSPENDED');

  // 25. Transactional Outbox (Deduplication, Dispatch, Backoff & DLQ)
  console.log('\n--- Step 25: Transactional Outbox (Deduplication, Dispatch, Backoff & DLQ) ---');
  const dedupeKeySuccess = `notif_success_${Date.now()}`;
  const outboxSuccessRes = await request('POST', '/outbox/enqueue', {
    channel: 'push',
    template: 'welcome_packet',
    payload: { memberName: 'Jane Doe' },
    dedupeKey: dedupeKeySuccess,
  }, tenantHeaders);
  assert(outboxSuccessRes.status === 201, 'Enqueued transactional outbox notification');
  assert(outboxSuccessRes.body.status === 'pending', 'Outbox status is pending');
  assert(outboxSuccessRes.body.isDuplicate === false, 'Initial item is not duplicate');

  // Deduplication check: re-enqueue same dedupeKey
  const outboxDedupeRes = await request('POST', '/outbox/enqueue', {
    channel: 'push',
    template: 'welcome_packet',
    payload: { memberName: 'Jane Doe' },
    dedupeKey: dedupeKeySuccess,
  }, tenantHeaders);
  assert(outboxDedupeRes.status === 201, 'Idempotent enqueue returned existing item');
  assert(outboxDedupeRes.body.isDuplicate === true, 'Duplicate correctly flagged');

  // Enqueue a failing item
  const dedupeKeyFail = `notif_fail_${Date.now()}`;
  const outboxFailRes = await request('POST', '/outbox/enqueue', {
    channel: 'sms',
    template: 'payment_alert',
    payload: { shouldFail: true },
    dedupeKey: dedupeKeyFail,
  }, tenantHeaders);
  assert(outboxFailRes.status === 201, 'Enqueued failing notification for retry testing');

  // Platform dispatch sweep
  const dispatch1Res = await request('POST', '/platform/outbox/dispatch', { limit: 10 }, adminHeaders);
  assert(dispatch1Res.status === 201, 'Dispatched pending outbox queue');
  assert(dispatch1Res.body.sentCount >= 1, 'Successful notification delivered');
  assert(dispatch1Res.body.failedCount >= 1, 'Failing notification transitioned to failed with retry scheduled');

  // Simulate reaching 5 attempts for dead-letter queue (DLQ)
  await pool.query(
    `UPDATE "notification_outbox" SET "attempts" = 4, "next_attempt_at" = NOW() - INTERVAL '1 minute' WHERE "dedupe_key" = $1;`,
    [dedupeKeyFail],
  );
  const dispatch2Res = await request('POST', '/platform/outbox/dispatch', { limit: 10 }, adminHeaders);
  assert(dispatch2Res.status === 201, 'Dispatched outbox again for DLQ test');
  assert(dispatch2Res.body.deadCount >= 1, 'Max attempts exhausted: item transitioned to dead (DLQ)');

  // Inspect outbox items
  const outboxListRes = await request('GET', '/outbox?limit=10', null, tenantHeaders);
  assert(outboxListRes.status === 200, 'Tenant retrieved outbox log');
  assert(Array.isArray(outboxListRes.body) && outboxListRes.body.length >= 2, 'Outbox entries retrieved');

  // 26. Executive Analytics & Reports Endpoints
  console.log('\n--- Step 26: Executive Analytics & Reports Endpoints ---');
  // Revenue report
  const revenueRes = await request('GET', '/reports/revenue', null, tenantHeaders);
  assert(revenueRes.status === 200, 'Retrieved executive revenue report');
  assert(revenueRes.body.summary.grossSalesMinor > 0, 'Gross sales recorded');
  assert(revenueRes.body.summary.vatRatePercent === 5, '5% VAT rate applied');
  assert(revenueRes.body.summary.vatMinor > 0, 'VAT amount calculated');
  assert(revenueRes.body.summary.netSalesMinor === revenueRes.body.summary.grossSalesMinor - revenueRes.body.summary.vatMinor, 'Net sales equals gross minus VAT');
  assert(revenueRes.body.byMethod.cash || revenueRes.body.byMethod.pos_card, 'Breakdown by payment method present');

  // Check-ins report & heatmap
  const checkinsReportRes = await request('GET', '/reports/checkins', null, tenantHeaders);
  assert(checkinsReportRes.status === 200, 'Retrieved check-in analytics and heatmap');
  assert(checkinsReportRes.body.summary.totalCheckIns > 0, 'Check-ins logged');
  assert(checkinsReportRes.body.byMethod.self_tap_temporary > 0, 'Self-tap check-in visits tracked');
  assert(checkinsReportRes.body.hourlyDistribution.length === 24, '24-hour heatmap distribution populated');

  // Manual adjustments report
  const adjustmentsReportRes = await request('GET', '/reports/manual-adjustments', null, tenantHeaders);
  assert(adjustmentsReportRes.status === 200, 'Retrieved manual adjustments report');
  assert(adjustmentsReportRes.body.summary.totalAdjustments >= 0, 'Adjustments summary present');

  // 27. Final Cryptographic SHA-256 Audit Trail Verification Across All Operations
  console.log('\n--- Step 27: Final Cryptographic SHA-256 Audit Trail Verification ---');
  const finalAuditRes = await request('POST', '/gyms/audit-logs/verify', null, tenantHeaders);
  assert(finalAuditRes.status === 201, 'Verified complete cryptographic audit chain across all stages');
  assert(finalAuditRes.body.isValid === true, '100% hash chain integrity verified (zero tampering)');
  console.log(`  ✓ Total verified audit chain records: ${finalAuditRes.body.verifiedCount}`);

  console.log('\n================================================================');
  console.log('🎉 ALL 27 TEST SUITE STAGES PASSED SUCCESSFULLY!');
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
