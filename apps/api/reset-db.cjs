/**
 * GymPulse Development Database Reset Script
 * 
 * Implements ADR / Project Rule: "Dev data is disposable."
 * Drops and recreates the public schema in the development database,
 * allowing clean application of migrations via `drizzle-kit migrate`.
 */

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

async function resetDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in apps/api/.env');
    process.exit(1);
  }

  // Safety check to prevent running against production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot reset database in production mode!');
    process.exit(1);
  }

  let dbHost = 'unknown';
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    dbHost = parsed.host;
  } catch {
    dbHost = (process.env.DATABASE_URL.match(/@([^:/]+)/) || [])[1] || 'configured-host';
  }

  console.log(`📡 Target database host: ${dbHost} (password hidden)`);
  console.log('🔄 Resetting development database schema (dev data is disposable)...');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO public;
      `);
      console.log('✅ Public schema cleanly recreated. Database is fresh.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Failed to reset database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
