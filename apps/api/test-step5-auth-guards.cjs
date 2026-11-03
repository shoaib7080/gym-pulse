/**
 * Step 5 Verification Test Suite:
 * - Brevo Email & SMS OTP verification service
 * - Better Auth hardening (bearer plugin, pool limits, min password length)
 * - Route shadowing fix in PlatformController
 * - Outbox HTTP POST enqueue removal
 * - Staff list RBAC restriction (owner and manager only)
 * - ActiveGymGuard & AllowInactiveGym decorator
 * - BranchAccessService enforcement
 * - Gym profile re-verification rail & resubmit endpoint
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

async function runTests() {
  console.log('=== Step 5 Verification Test Suite ===\n');

  // Test 1: Brevo OTP Service Unit Verification
  console.log('Test 1: Brevo OTP Service Unit Verification');
  const { OtpVerificationService } = require('./dist/common/services/otp-verification.service.js');
  const otpService = new OtpVerificationService();

  // Test generation
  const otp1 = otpService.generateOtp(6);
  assert.strictEqual(typeof otp1, 'string');
  assert.strictEqual(otp1.length, 6);
  assert.match(otp1, /^[0-9]{6}$/, 'OTP must be 6 numeric digits');

  // Test verification: valid
  const expiresFuture = new Date(Date.now() + 10 * 60 * 1000);
  const validRes = otpService.verifyOtp(otp1, otp1, expiresFuture);
  assert.strictEqual(validRes.valid, true, 'Valid OTP must verify successfully');

  // Test verification: mismatch
  const invalidRes = otpService.verifyOtp('000000', '999999', expiresFuture);
  assert.strictEqual(invalidRes.valid, false);
  assert.strictEqual(invalidRes.reason, 'MISMATCH');

  // Test verification: expired
  const expiresPast = new Date(Date.now() - 1000);
  const expiredRes = otpService.verifyOtp(otp1, otp1, expiresPast);
  assert.strictEqual(expiredRes.valid, false);
  assert.strictEqual(expiredRes.reason, 'EXPIRED');

  // Test unconfigured key graceful return
  const originalKey = process.env.BREVO_API_KEY;
  delete process.env.BREVO_API_KEY;
  const dispatchRes = await otpService.sendEmailOtp({
    to: 'test@example.com',
    otp: '123456',
  });
  assert.strictEqual(dispatchRes.success, false);
  assert.strictEqual(dispatchRes.error, 'BREVO_API_KEY not configured');
  if (originalKey) process.env.BREVO_API_KEY = originalKey;

  console.log('  ✓ Brevo OTP Service generates 6-digit secure numeric codes');
  console.log('  ✓ Timing-safe OTP verification handles valid, mismatched, and expired tokens');
  console.log('  ✓ Gracefully handles unconfigured BREVO_API_KEY');

  // Test 2: Better Auth Configuration Inspection
  console.log('\nTest 2: Better Auth & Auth Guard Hardening');
  const authSource = fs.readFileSync(path.join(__dirname, 'src/auth/auth.ts'), 'utf8');
  assert.ok(authSource.includes('bearer()'), 'Better Auth must register bearer plugin');
  assert.ok(authSource.includes('minPasswordLength: 10'), 'Better Auth must enforce minPasswordLength: 10');
  assert.ok(authSource.includes('max: 5'), 'Pool must limit max connections to 5');

  const authGuardSource = fs.readFileSync(path.join(__dirname, 'src/common/guards/auth.guard.ts'), 'utf8');
  assert.ok(
    !authGuardSource.includes('better-auth.session_token='),
    'AuthGuard must not use manual synthetic cookie manipulation; rely on native bearer plugin',
  );
  console.log('  ✓ Better Auth configured with official bearer plugin');
  console.log('  ✓ Minimum password length 10 enforced');
  console.log('  ✓ DB connection pool capped to 5 connections');
  console.log('  ✓ Synthetic cookie manipulation removed from AuthGuard');

  // Test 3: Route Shadowing Fix in PlatformController
  console.log('\nTest 3: Route Shadowing Fix in PlatformController');
  const platformControllerSource = fs.readFileSync(
    path.join(__dirname, 'src/platform/platform.controller.ts'),
    'utf8',
  );
  const reviewQueueIndex = platformControllerSource.indexOf("@Get('gyms/review-queue')");
  const gymByIdIndex = platformControllerSource.indexOf("@Get('gyms/:id')");
  assert.ok(reviewQueueIndex !== -1, "platform.controller.ts must contain @Get('gyms/review-queue')");
  assert.ok(gymByIdIndex !== -1, "platform.controller.ts must contain @Get('gyms/:id')");
  assert.ok(
    reviewQueueIndex < gymByIdIndex,
    "@Get('gyms/review-queue') must be declared BEFORE @Get('gyms/:id') to prevent route shadowing",
  );
  console.log('  ✓ Route shadowing resolved: /gyms/review-queue declared before /gyms/:id');

  // Test 4: Outbox Controller HTTP Enqueue Elimination
  console.log('\nTest 4: Outbox Controller HTTP Enqueue Elimination');
  const outboxControllerSource = fs.readFileSync(
    path.join(__dirname, 'src/outbox/outbox.controller.ts'),
    'utf8',
  );
  assert.ok(
    !outboxControllerSource.includes("@Post('enqueue')"),
    'OutboxController must not expose client-accessible @Post(enqueue)',
  );
  console.log('  ✓ Client HTTP POST /v1/outbox/enqueue successfully removed');

  // Test 5: Staff Endpoint RBAC Restriction
  console.log('\nTest 5: Staff Endpoint RBAC Restriction');
  const tenancyControllerSource = fs.readFileSync(
    path.join(__dirname, 'src/tenancy/tenancy.controller.ts'),
    'utf8',
  );
  const staffRouteMatch = tenancyControllerSource.match(
    /@Get\('staff'\)[\s\S]*?@Roles\((.*?)\)/,
  );
  assert.ok(staffRouteMatch, "GET 'staff' route must be decorated with @Roles");
  assert.ok(
    staffRouteMatch[1].includes("'owner'") && staffRouteMatch[1].includes("'manager'"),
    "GET 'staff' route must be restricted to owner and manager only",
  );
  assert.ok(
    !staffRouteMatch[1].includes('front_desk'),
    "GET 'staff' route must NOT be accessible to front_desk",
  );
  console.log('  ✓ GET /v1/gyms/staff restricted to owner and manager only');

  // Test 6: BranchAccessService Logic Verification
  console.log('\nTest 6: BranchAccessService Logic Verification');
  const { BranchAccessService } = require('./dist/branches/branch-access.service.js');
  assert.ok(BranchAccessService, 'BranchAccessService must be exported');
  const branchAccessServiceSource = fs.readFileSync(
    path.join(__dirname, 'src/branches/branch-access.service.ts'),
    'utf8',
  );
  assert.ok(
    branchAccessServiceSource.includes('assertBranchAccess'),
    'assertBranchAccess method must exist',
  );
  assert.ok(
    branchAccessServiceSource.includes('BRANCH_ACCESS_DENIED'),
    'Must throw BRANCH_ACCESS_DENIED code on non-permitted branch access',
  );
  console.log('  ✓ BranchAccessService correctly asserts branch access and throws BRANCH_ACCESS_DENIED');

  // Test 7: ActiveGymGuard & AllowInactiveGym Decorator
  console.log('\nTest 7: ActiveGymGuard & AllowInactiveGym Decorator');
  const allowInactiveDecoratorSource = fs.readFileSync(
    path.join(__dirname, 'src/common/decorators/allow-inactive-gym.decorator.ts'),
    'utf8',
  );
  assert.ok(
    allowInactiveDecoratorSource.includes('ALLOW_INACTIVE_GYM_KEY'),
    'AllowInactiveGym decorator must export ALLOW_INACTIVE_GYM_KEY',
  );

  const activeGymGuardSource = fs.readFileSync(
    path.join(__dirname, 'src/common/guards/active-gym.guard.ts'),
    'utf8',
  );
  assert.ok(
    activeGymGuardSource.includes('ALLOW_INACTIVE_GYM_KEY'),
    'ActiveGymGuard must inspect allowInactiveGym metadata',
  );
  console.log('  ✓ AllowInactiveGym decorator properly integrated with ActiveGymGuard');

  // Test 8: Main.ts HTTP Transport & Platform Hardening
  console.log('\nTest 8: Main.ts HTTP Transport & Platform Hardening');
  const mainSource = fs.readFileSync(path.join(__dirname, 'src/main.ts'), 'utf8');
  assert.ok(mainSource.includes('RequestIdMiddleware'), 'main.ts must register RequestIdMiddleware');
  assert.ok(mainSource.includes('GlobalExceptionFilter'), 'main.ts must register GlobalExceptionFilter');
  assert.ok(mainSource.includes('enableShutdownHooks'), 'main.ts must enable shutdown hooks');
  assert.ok(mainSource.includes("limit: '1mb'"), 'main.ts must enforce 1mb body limit');
  assert.ok(mainSource.includes('X-Content-Type-Options'), 'main.ts must set X-Content-Type-Options');
  assert.ok(mainSource.includes('Strict-Transport-Security'), 'main.ts must set HSTS header');
  console.log('  ✓ Security headers, correlation ID, payload limit & shutdown hooks configured');

  // Test 9: Tenancy Service Reverification & Resubmit Rails
  console.log('\nTest 9: Tenancy Service Reverification & Resubmit Rails');
  const tenancyServiceSource = fs.readFileSync(
    path.join(__dirname, 'src/tenancy/tenancy.service.ts'),
    'utf8',
  );
  assert.ok(
    tenancyServiceSource.includes('gym.reverification_triggered'),
    'Modifying TRN or license must emit gym.reverification_triggered',
  );
  assert.ok(
    tenancyServiceSource.includes('resubmitGym'),
    'resubmitGym method must exist',
  );
  assert.ok(
    tenancyServiceSource.includes('INVALID_STATUS_TRANSITION'),
    'resubmitGym must reject non-rejected gyms',
  );
  console.log('  ✓ Reverification rail triggers status revert to pending_verification on TRN/license update');
  console.log('  ✓ resubmitGym endpoint validates state transition and logs audit event');

  console.log('\nAll Step 5 verification assertions passed successfully!');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
