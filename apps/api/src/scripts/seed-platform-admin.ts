import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { auth } from '../auth/auth';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function seedAdmin() {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowProdSeed = process.env.ALLOW_PROD_SEED === 'true';

  if (isProduction && !allowProdSeed) {
    console.error('❌ Safety guard: Refusing to seed platform admin in production without ALLOW_PROD_SEED=true');
    process.exit(1);
  }

  const targetEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const targetPassword = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!targetEmail) {
    console.error('❌ Missing PLATFORM_ADMIN_EMAIL environment variable.');
    console.error('Set PLATFORM_ADMIN_EMAIL in apps/api/.env or pass it when running the command.');
    process.exit(1);
  }

  if (!targetPassword) {
    console.error('❌ Missing PLATFORM_ADMIN_PASSWORD environment variable.');
    console.error('Set PLATFORM_ADMIN_PASSWORD in apps/api/.env or pass it when running the command.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is missing in apps/api/.env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('sslmode=require') || dbUrl.includes('sslmode=verify-full')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  console.log('====================================================');
  console.log('🛡️  GymPulse Platform Admin Provisioning');
  console.log(`Target Email: ${targetEmail}`);
  console.log('====================================================');

  const client = await pool.connect();
  try {
    // 1. Check if user exists in auth_user
    const userRes = await client.query(
      `SELECT id, name, email FROM "auth_user" WHERE lower(email) = $1 LIMIT 1`,
      [targetEmail],
    );

    let authUserId: string;
    let authUserName: string = 'Platform Superadmin';

    if (userRes.rows.length === 0) {
      console.log(`Creating user '${targetEmail}' via Better Auth...`);
      try {
        const signUpRes = await auth.api.signUpEmail({
          body: {
            email: targetEmail,
            password: targetPassword,
            name: process.env.PLATFORM_ADMIN_NAME || 'Platform Superadmin',
          },
        });
        if (!signUpRes?.user?.id) {
          throw new Error('Failed to create auth user via Better Auth');
        }
        authUserId = signUpRes.user.id;
        authUserName = signUpRes.user.name || 'Platform Superadmin';
        console.log(`✅ 1. Created new auth user: ${authUserName} (${authUserId})`);
      } catch (authErr: any) {
        console.error('❌ Better Auth sign-up error:', authErr?.message || authErr);
        process.exit(1);
      }
    } else {
      const authUser = userRes.rows[0];
      authUserId = authUser.id;
      authUserName = authUser.name || 'Platform Superadmin';
      console.log(`✅ 1. Found existing auth user: ${authUserName} (${authUserId})`);
    }

    // 2. Ensure domain user row exists in 'users' table
    const domainUserRes = await client.query(
      `SELECT id, full_name FROM "users" WHERE auth_user_id = $1 LIMIT 1`,
      [authUserId],
    );

    let domainUserId: string;
    if (domainUserRes.rows.length === 0) {
      const inserted = await client.query(
        `INSERT INTO "users" ("auth_user_id", "email", "full_name", "name_search")
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [
          authUserId,
          targetEmail,
          authUserName,
          authUserName.toLowerCase(),
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
    console.log(`Auth User ID   : ${authUserId}`);
    console.log(`Role           : ${admin.role}`);
    console.log(`Is Active      : ${admin.is_active}\n`);
  } catch (err: any) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin();
