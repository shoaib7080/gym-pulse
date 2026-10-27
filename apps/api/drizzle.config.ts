import * as dotenv from 'dotenv';
import * as path from 'path';
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is missing in apps/api/.env!');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
