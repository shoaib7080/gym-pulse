/**
 * GymPulse Development Database Reset Script
 * 
 * Implements ADR / Project Rule: "Dev data is disposable."
 * Strictly guarded against running on non-dev databases or in production.
 */

const path = require('node:path');
const readline = require('node:readline');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

const DB_NAME_REGEX = /(dev|test|local|scratch)/i;

async function askConfirmation(expectedDbName) {
  if (process.env.CI === 'true') {
    console.log('🤖 CI=true detected: skipping interactive confirmation prompt.');
    return true;
  }

  // If stdin is not a TTY (e.g. piped or automated non-interactive run without CI=true)
  if (!process.stdin.isTTY) {
    console.log('⚠️ Non-interactive shell detected: requiring CI=true to bypass interactive confirmation.');
    return false;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `⚠️  DANGER: This will DROP and recreate schema public in database '${expectedDbName}'.\nType '${expectedDbName}' to confirm: `,
      (answer) => {
        rl.close();
        resolve(answer.trim() === expectedDbName);
      },
    );
  });
}

async function resetDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in apps/api/.env');
    process.exit(1);
  }

  // Guard 1: ALLOW_DB_RESET=true must be set
  if (process.env.ALLOW_DB_RESET !== 'true') {
    console.error('❌ Safety guard: ALLOW_DB_RESET=true is required to reset the database.');
    console.error('Set ALLOW_DB_RESET=true in your environment or command invocation.');
    process.exit(1);
  }

  // Guard 2: Refuse production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Safety guard: Cannot reset database when NODE_ENV=production!');
    process.exit(1);
  }

  // Parse DB Host and Name
  let dbHost = 'unknown';
  let dbName = '';
  try {
    const parsed = new URL(dbUrl);
    dbHost = parsed.host;
    dbName = parsed.pathname.replace(/^\//, '').split('?')[0];
  } catch {
    const hostMatch = dbUrl.match(/@([^:/]+)/);
    const dbMatch = dbUrl.match(/\/([^/?]+)(\?|$)/);
    dbHost = hostMatch ? hostMatch[1] : 'unknown';
    dbName = dbMatch ? dbMatch[1] : '';
  }

  // Guard 3: Database name must match /(dev|test|local|scratch)/i
  if (!dbName || !DB_NAME_REGEX.test(dbName)) {
    console.error(
      `❌ Safety guard: Target database '${dbName}' does not match /(dev|test|local|scratch)/i.`,
    );
    console.error('Refusing to reset a potentially non-development database.');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('🚨 GymPulse Database Reset Initiated');
  console.log(`📡 Database Host : ${dbHost} (credentials hidden)`);
  console.log(`🗄️  Database Name : ${dbName}`);
  console.log('====================================================');

  const confirmed = await askConfirmation(dbName);
  if (!confirmed) {
    console.error('❌ Confirmation failed or aborted. Database was NOT modified.');
    process.exit(1);
  }

  console.log('🔄 Resetting development database schema (dev data is disposable)...');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('sslmode=require') || dbUrl.includes('sslmode=verify-full')
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
    console.error('❌ Failed to reset database:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
