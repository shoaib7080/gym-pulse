const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL is missing in apps/api/.env');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';
const allowProdSeed = process.env.ALLOW_PRODUCTION_SEED === 'true' || process.argv.includes('--force-prod');

if (isProduction && !allowProdSeed) {
  console.error('❌ Refusing to run seed script in production without --force-prod or ALLOW_PRODUCTION_SEED=true');
  process.exit(1);
}

const targetEmail = (
  process.env.PLATFORM_ADMIN_EMAIL ||
  process.argv[2] ||
  'admin@gympulse.ae'
).toLowerCase().trim();

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

async function seedAdmin() {
  console.log('====================================================');
  console.log(`🛡️  GymPulse Platform Admin Provisioning`);
  console.log(`Target Email: ${targetEmail}`);
  console.log('====================================================');

  const client = await pool.connect();
  try {
    // 1. Check if user exists in auth_user
    const userRes = await client.query(
      `SELECT id, name, email FROM "auth_user" WHERE lower(email) = $1 LIMIT 1`,
      [targetEmail],
    );

    if (userRes.rows.length === 0) {
      console.log(`\n⚠️  User '${targetEmail}' was not found in 'auth_user'.`);
      console.log(`To create this user:`);
      console.log(`1. Call: POST /v1/auth/sign-up/email`);
      console.log(`   Body: { "email": "${targetEmail}", "password": "AdminPassword123!", "name": "Platform Superadmin" }`);
      console.log(`2. Then re-run: pnpm --filter api seed:platform-admin\n`);
      return;
    }

    const authUser = userRes.rows[0];
    console.log(`✅ 1. Found auth user: ${authUser.name} (${authUser.id})`);

    // 2. Ensure domain user row exists in 'users' table
    const domainUserRes = await client.query(
      `SELECT id, full_name FROM "users" WHERE auth_user_id = $1 LIMIT 1`,
      [authUser.id],
    );

    let domainUserId;
    if (domainUserRes.rows.length === 0) {
      const inserted = await client.query(
        `INSERT INTO "users" ("auth_user_id", "email", "full_name", "name_search")
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [
          authUser.id,
          authUser.email,
          authUser.name || 'Platform Superadmin',
          (authUser.name || 'Platform Superadmin').toLowerCase(),
        ],
      );
      domainUserId = inserted.rows[0].id;
      console.log(`✅ 2. Created domain user record with UUID: ${domainUserId}`);
    } else {
      domainUserId = domainUserRes.rows[0].id;
      console.log(`✅ 2. Found domain user UUID: ${domainUserId}`);
    }

    // 3. Upsert into platform_admins table using domain user UUID
    const adminRes = await client.query(
      `
      INSERT INTO "platform_admins" ("user_id", "role", "is_active", "updated_at")
      VALUES ($1, 'superadmin', true, now())
      ON CONFLICT ("user_id") 
      DO UPDATE SET "is_active" = true, "role" = 'superadmin', "updated_at" = now()
      RETURNING id, role, is_active, created_at;
      `,
      [domainUserId],
    );

    const admin = adminRes.rows[0];
    console.log(`\n🎉 SUCCESS! User is now a Platform Superadmin!`);
    console.log(`Admin ID       : ${admin.id}`);
    console.log(`Domain User ID : ${domainUserId}`);
    console.log(`Auth User ID   : ${authUser.id}`);
    console.log(`Role           : ${admin.role}`);
    console.log(`Is Active      : ${admin.is_active}\n`);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin();
