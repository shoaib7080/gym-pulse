import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

export const db = drizzle(pool, { schema });

const trustedOrigins = process.env.TRUSTED_ORIGINS
  ? process.env.TRUSTED_ORIGINS.split(',').map((o) => o.trim())
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

const isTestEnv = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.authUsers,
      session: schema.authSessions,
      account: schema.authAccounts,
      verification: schema.authVerifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins,
  advanced: {
    disableCSRFCheck: isTestEnv,
    useSecureCookies: isProd,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/v1/auth',
});
