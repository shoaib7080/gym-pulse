/**
 * DEPRECATED: Do not use ad-hoc schema migration scripts.
 * 
 * In accordance with GymPulse Architecture Rules:
 * "Migrations only. Schema changes go through Drizzle (db:generate, review the SQL, db:migrate).
 *  No runtime schema patching and no ad-hoc .cjs schema scripts."
 * 
 * Please run:
 *   pnpm --filter api db:generate
 *   pnpm --filter api db:migrate
 */
console.warn('⚠️ This ad-hoc schema script has been deprecated. Use `pnpm --filter api db:migrate` instead.');
process.exit(0);
