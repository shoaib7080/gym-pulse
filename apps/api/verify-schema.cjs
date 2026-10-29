const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

async function verify() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('\n--- Query 1: SELECT extname FROM pg_extension WHERE extname = \'btree_gist\'; ---');
    const extRes = await pool.query("SELECT extname FROM pg_extension WHERE extname = 'btree_gist';");
    console.table(extRes.rows);

    console.log('\n--- Query 2: SELECT conname FROM pg_constraint WHERE conname IN (\'no_overlapping_freezes\', \'freeze_dates_valid\'); ---');
    const conRes = await pool.query(
      "SELECT conname FROM pg_constraint WHERE conname IN ('no_overlapping_freezes', 'freeze_dates_valid');"
    );
    console.table(conRes.rows);

    console.log('\n--- Query 3: SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY 1; ---');
    const tablesRes = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;"
    );
    console.table(tablesRes.rows);
  } finally {
    await pool.end();
  }
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
