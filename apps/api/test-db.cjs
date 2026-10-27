const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

console.log('====================================================');
console.log('🔍 GymPulse Supabase Connection Diagnostic');
console.log('====================================================');
console.log('URL:', dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : 'UNDEFINED');

if (!dbUrl) {
  console.error('\n❌ ERROR: DATABASE_URL is not defined!');
  process.exit(1);
}

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

async function runTest() {
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db, current_user as usr, version() as ver;');
    console.log('\n✅ 1. CONNECTED TO DATABASE SUCCESSFULLY!');
    console.log('Current Time :', res.rows[0].now);
    console.log('Database     :', res.rows[0].db);
    console.log('User         :', res.rows[0].usr);
    console.log('Version      :', res.rows[0].ver.split(' ')[0], res.rows[0].ver.split(' ')[1]);

    // Check existing tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('\n📋 2. Existing Public Tables:', tables.rows.map(r => r.table_name));

    // Check if __drizzle_migrations table exists
    const hasDrizzle = tables.rows.some(r => r.table_name === '__drizzle_migrations');
    console.log('Drizzle Migrations Table Exists:', hasDrizzle);

    console.log('\n🎉 Database is 100% accessible and ready for migrations!');
  } catch (err) {
    console.error('\n❌ CONNECTION / QUERY FAILED:');
    console.error('Error Code   :', err.code);
    console.error('Error Message:', err.message);
    if (err.detail) console.error('Detail       :', err.detail);
    if (err.hint) console.error('Hint         :', err.hint);
    if (err.routine) console.error('Routine      :', err.routine);
  } finally {
    await pool.end();
  }
}

runTest();
