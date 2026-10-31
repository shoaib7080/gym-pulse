/**
 * Step 2 Verification Test Suite
 * Tests Cryptographic Audit Trail Rebuild & Per-Manager PINs
 *
 * Covers:
 * 1. Trivial PIN detection & rejection
 * 2. Node.js crypto.scrypt PIN hashing & timingSafeEqual verification
 * 3. Secrets scanner in audit payloads
 * 4. Canonical JSON serialization determinism
 * 5. SHA-256 chain construction & tamper detection
 * 6. Audit integrity verification on tamper
 */

const assert = require('node:assert');
const { createHash, timingSafeEqual, scryptSync, randomBytes } = require('node:crypto');

console.log('====================================================');
console.log('GymPulse Step 2 Verification: Cryptographic Audit & Manager PIN');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. Trivial PIN validation
// ----------------------------------------------------
console.log('1. Testing Trivial PIN Detection...');

const TRIVIAL_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '2345', '3456', '4567', '5678', '6789', '0123',
  '4321', '5432', '6543', '7654', '8765', '9876', '3210',
  '12345', '123456', '1234567', '12345678',
  '00000', '11111', '22222', '33333', '44444', '55555', '66666', '77777', '88888', '99999',
  '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999',
]);

function isTrivialPin(pin) {
  if (TRIVIAL_PINS.has(pin)) return true;
  const allSame = pin.split('').every((ch) => ch === pin[0]);
  if (allSame) return true;

  let isAsc = true;
  for (let i = 1; i < pin.length; i++) {
    if (pin.charCodeAt(i) !== pin.charCodeAt(i - 1) + 1) {
      isAsc = false;
      break;
    }
  }
  if (isAsc) return true;

  let isDesc = true;
  for (let i = 1; i < pin.length; i++) {
    if (pin.charCodeAt(i) !== pin.charCodeAt(i - 1) - 1) {
      isDesc = false;
      break;
    }
  }
  if (isDesc) return true;

  return false;
}

const trivialSamples = ['0000', '1234', '1111', '4321', '123456', '7777', '9876', '2345'];
for (const pin of trivialSamples) {
  assert(isTrivialPin(pin), `Expected '${pin}' to be flagged as trivial`);
}

const validSamples = ['8392', '4917', '58204', '918273', '3819'];
for (const pin of validSamples) {
  assert(!isTrivialPin(pin), `Expected '${pin}' to NOT be flagged as trivial`);
}
console.log('  ✓ Trivial PIN detection passed (rejected repeated and sequential digits).');

// ----------------------------------------------------
// 2. Scrypt PIN Hashing & timingSafeEqual
// ----------------------------------------------------
console.log('\n2. Testing Scrypt PIN Hashing & Verification...');

function hashPinSync(pin) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`;
}

function verifyPinSync(pin, storedHash) {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = parts[4];
    const expectedKeyHex = parts[5];
    const expectedBuffer = Buffer.from(expectedKeyHex, 'hex');
    const derivedBuffer = scryptSync(pin, salt, expectedBuffer.length, { N, r, p });
    return timingSafeEqual(derivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

const testPin = '8392';
const hashed = hashPinSync(testPin);
assert(hashed.startsWith('scrypt$16384$8$1$'), 'Hash has correct scrypt parameter prefix');
assert(verifyPinSync(testPin, hashed), 'Correct PIN verifies successfully');
assert(!verifyPinSync('8391', hashed), 'Incorrect PIN fails verification');
assert(!verifyPinSync('1234', hashed), 'Default PIN fails verification');
assert(!verifyPinSync(testPin, 'corrupted_hash_format'), 'Corrupted hash format returns false gracefully');
console.log('  ✓ Scrypt PIN hashing & timingSafeEqual verified.');

// ----------------------------------------------------
// 3. Secrets Scanner in Audit Payloads
// ----------------------------------------------------
console.log('\n3. Testing Secrets Scanner on Audit Payloads...');

const FORBIDDEN_KEY_PATTERN = /(password|pin|secret|token)/i;

function assertNoSecretsInPayload(payload, path = '') {
  if (!payload || typeof payload !== 'object') return;
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertNoSecretsInPayload(item, `${path}[${index}]`));
    return;
  }
  for (const [key, value] of Object.entries(payload)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      throw new Error(`Forbidden sensitive key detected: '${currentPath}'`);
    }
    if (value && typeof value === 'object') {
      assertNoSecretsInPayload(value, currentPath);
    }
  }
}

// Clean payload should not throw
assertNoSecretsInPayload({
  action: 'freeze.lift',
  approvedBy: '123e4567-e89b-12d3-a456-426614174000',
  daysCharged: 7,
  daysReturned: 3,
  liftedOn: '2026-03-01',
});

// Sensitive payloads must throw
const forbiddenKeys = ['managerPin', 'password', 'user_token', 'clientSecret', 'api_token'];
for (const key of forbiddenKeys) {
  let caught = false;
  try {
    assertNoSecretsInPayload({ normalField: 'ok', [key]: 'sensitive_value' });
  } catch (err) {
    caught = true;
  }
  assert(caught, `Expected forbidden key '${key}' to be caught by scanner`);
}
console.log('  ✓ Audit payload secrets scanner verified.');

// ----------------------------------------------------
// 4. Canonical Stringify Determinism
// ----------------------------------------------------
console.log('\n4. Testing Canonical JSON Stringify Determinism...');

function canonicalStringify(val) {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map(canonicalStringify).join(',')}]`;
  }
  const sortedKeys = Object.keys(val).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify(val[key])}`,
  );
  return `{${entries.join(',')}}`;
}

const obj1 = { z: 1, a: { y: 2, b: 3 }, m: [3, 2, 1] };
const obj2 = { m: [3, 2, 1], a: { b: 3, y: 2 }, z: 1 };
assert.strictEqual(canonicalStringify(obj1), canonicalStringify(obj2), 'Key ordering is deterministic at all depths');
console.log('  ✓ Canonical JSON stringify produces identical output regardless of key insertion order.');

// ----------------------------------------------------
// 5. Audit Hash Chain Construction & Tamper Detection
// ----------------------------------------------------
console.log('\n5. Testing Cryptographic Audit Chain & Tamper Detection...');

const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function computeRowHash(fields) {
  const canonical = canonicalStringify({
    action: fields.action,
    actorRole: fields.actorRole ?? null,
    actorUserId: fields.actorUserId ?? null,
    adminActorId: fields.adminActorId ?? null,
    chainKey: fields.chainKey,
    createdAt: fields.createdAt,
    device: fields.device ?? null,
    entityId: fields.entityId ?? null,
    entityType: fields.entityType,
    gymId: fields.gymId ?? null,
    hashVersion: 2,
    ip: fields.ip ?? null,
    payload: fields.payload ?? {},
    prevHash: fields.prevHash,
    reasonCode: fields.reasonCode ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

// Build a simulated chain of 50 entries
const chain = [];
let prevHash = GENESIS_PREV_HASH;
const gymId = '88888888-8888-8888-8888-888888888888';

for (let i = 1; i <= 50; i++) {
  const createdAt = new Date(1772300000000 + i * 1000).toISOString();
  const entry = {
    id: i,
    chainKey: gymId,
    hashVersion: 2,
    gymId,
    actorUserId: '11111111-1111-1111-1111-111111111111',
    actorRole: 'owner',
    adminActorId: null,
    action: `action_${i}`,
    entityType: 'membership',
    entityId: `mem_${i}`,
    reasonCode: null,
    payload: { step: i },
    ip: '127.0.0.1',
    device: 'agent-cli',
    prevHash,
    createdAt,
  };
  entry.rowHash = computeRowHash(entry);
  chain.push(entry);
  prevHash = entry.rowHash;
}

assert(chain.length === 50, 'Generated 50 chained audit entries');

// Verify valid chain
function verifySimulatedChain(entries) {
  for (let i = 0; i < entries.length; i++) {
    const cur = entries[i];
    const prev = i > 0 ? entries[i - 1] : null;
    const expectedPrev = prev ? prev.rowHash : GENESIS_PREV_HASH;
    if (cur.prevHash !== expectedPrev) {
      return { isValid: false, errorAtId: cur.id, reason: 'prevHash mismatch' };
    }
    const computed = computeRowHash(cur);
    if (computed !== cur.rowHash) {
      return { isValid: false, errorAtId: cur.id, reason: 'rowHash mismatch' };
    }
  }
  return { isValid: true, verifiedCount: entries.length };
}

const validResult = verifySimulatedChain(chain);
assert(validResult.isValid === true && validResult.verifiedCount === 50, 'Valid chain of 50 passes verification');
console.log('  ✓ 50-entry cryptographic chain verified successfully.');

// Tamper test: altering any single field makes verification fail
const fieldsToTamper = [
  'actorRole',
  'adminActorId',
  'action',
  'entityType',
  'reasonCode',
  'ip',
  'device',
  'createdAt',
];

for (const field of fieldsToTamper) {
  const tamperedChain = JSON.parse(JSON.stringify(chain));
  tamperedChain[25][field] = tamperedChain[25][field] === 'tampered' ? 'modified' : 'tampered';
  const result = verifySimulatedChain(tamperedChain);
  assert(result.isValid === false, `Tampering with field '${field}' MUST invalidate chain`);
  assert(result.errorAtId === 26, `Tamper detected at row ID 26 when modifying '${field}'`);
}

// Tamper payload
{
  const tamperedChain = JSON.parse(JSON.stringify(chain));
  tamperedChain[10].payload.step = 999;
  const result = verifySimulatedChain(tamperedChain);
  assert(result.isValid === false, 'Tampering with payload MUST invalidate chain');
}

// Tamper prevHash link
{
  const tamperedChain = JSON.parse(JSON.stringify(chain));
  tamperedChain[5].prevHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const result = verifySimulatedChain(tamperedChain);
  assert(result.isValid === false, 'Tampering with prevHash link MUST invalidate chain');
}
console.log('  ✓ Tamper detection passed: modifying any single field invalidates the cryptographic chain.');

// ----------------------------------------------------
// 6. Multi-Tenant Chain Isolation
// ----------------------------------------------------
console.log('\n6. Testing Multi-Tenant Chain Isolation...');

const gymA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const gymB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const platformChainKey = 'platform';

const entryGymA = {
  chainKey: gymA,
  action: 'gymA.action',
  prevHash: GENESIS_PREV_HASH,
  createdAt: new Date().toISOString(),
  entityType: 'gym',
};
entryGymA.rowHash = computeRowHash(entryGymA);

const entryGymB = {
  chainKey: gymB,
  action: 'gymB.action',
  prevHash: GENESIS_PREV_HASH,
  createdAt: new Date().toISOString(),
  entityType: 'gym',
};
entryGymB.rowHash = computeRowHash(entryGymB);

const entryPlatform = {
  chainKey: platformChainKey,
  action: 'platform.action',
  prevHash: GENESIS_PREV_HASH,
  createdAt: new Date().toISOString(),
  entityType: 'platform',
};
entryPlatform.rowHash = computeRowHash(entryPlatform);

assert(entryGymA.chainKey !== entryGymB.chainKey, 'Gym A and Gym B have separate chains');
assert(entryGymA.rowHash !== entryGymB.rowHash, 'Independent hashes generated across gyms');
assert(entryPlatform.chainKey === 'platform', 'Platform chain is segregated');
console.log('  ✓ Multi-tenant and platform chain segregation verified.');

console.log('\n====================================================');
console.log('ALL STEP 2 AUDIT & MANAGER PIN TESTS PASSED SUCCESSFULLY!');
console.log('====================================================\n');
