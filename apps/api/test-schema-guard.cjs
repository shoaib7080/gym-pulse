/**
 * Verification unit test for SchemaGuard behavior
 * Validates that SchemaGuard refuses to allow the application to start
 * when NODE_ENV=production and constraints are missing.
 */
const assert = require('node:assert');

async function testProductionRefusal() {
  console.log('Testing SchemaGuard refusal when NODE_ENV=production and constraint missing...');
  
  process.env.NODE_ENV = 'production';

  // Mock Database where no_overlapping_freezes is missing
  const mockDb = {
    execute: async (query) => {
      const q = typeof query === 'string' ? query : query?.queryChunks?.[0]?.value || '';
      if (q.includes('pg_extension')) {
        return { rows: [{ extname: 'btree_gist' }] };
      }
      if (q.includes('pg_constraint')) {
        // Missing no_overlapping_freezes
        return { rows: [{ conname: 'freeze_dates_valid' }] };
      }
      return { rows: [] };
    },
  };

  let threw = false;
  try {
    const { SchemaGuard } = require('./dist/db/schema-guard.service');
    const guard = new SchemaGuard(mockDb);
    await guard.verifySchema();
  } catch (err) {
    threw = true;
    assert(
      err.message.includes("constraint 'no_overlapping_freezes'"),
      `Expected error to name missing constraint, got: ${err.message}`
    );
    console.log('  ✓ SchemaGuard successfully threw in production:', err.message);
  }

  assert(threw, 'SchemaGuard must throw in production when constraint is missing');
  console.log('  ✓ Verified: application refuses to start in production without no_overlapping_freezes.\n');
}

testProductionRefusal().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
