import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from './db.tokens';

@Injectable()
export class SchemaGuard implements OnModuleInit {
  private readonly logger = new Logger(SchemaGuard.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  async onModuleInit() {
    await this.verifySchema();
  }

  /**
   * Read-only schema verification gate.
   * Runs SELECT queries to confirm required extensions, constraints, and immutability triggers exist without needing DDL privileges.
   */
  async verifySchema() {
    try {
      // 0. Auto-ensure gym_daily_runs table and payment idempotency columns exist (safe IF NOT EXISTS)
      try {
        await this.db.execute(sql`
          CREATE TABLE IF NOT EXISTS "gym_daily_runs" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "gym_id" uuid NOT NULL REFERENCES "gyms"("id") ON DELETE cascade,
            "local_date" date NOT NULL,
            "processed_at" timestamp with time zone DEFAULT now() NOT NULL,
            "freezes_activated" integer DEFAULT 0 NOT NULL,
            "freezes_completed" integer DEFAULT 0 NOT NULL,
            "freezes_expired" integer DEFAULT 0 NOT NULL,
            "status" text DEFAULT 'success' NOT NULL,
            "error_message" text
          );
          CREATE UNIQUE INDEX IF NOT EXISTS "gym_daily_runs_gym_date_uq" ON "gym_daily_runs" ("gym_id", "local_date");
          CREATE INDEX IF NOT EXISTS "gym_daily_runs_gym_idx" ON "gym_daily_runs" ("gym_id");
          ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
          ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "request_hash" text;
          CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_uq" ON "payments" ("gym_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;
        `);
      } catch (autoErr: any) {
        this.logger.warn(`[SchemaGuard] Auto-provisioning gym_daily_runs skipped: ${autoErr?.message}`);
      }

      // 1. Check btree_gist extension
      const extRes = await this.db.execute<{ extname: string }>(
        sql`SELECT extname FROM pg_extension WHERE extname = 'btree_gist';`,
      );
      const rows = (extRes as any)?.rows || (Array.isArray(extRes) ? extRes : []);
      const hasBtreeGist = rows.length > 0;

      // 2. Check no_overlapping_freezes and freeze_dates_valid constraints
      const conRes = await this.db.execute<{ conname: string }>(
        sql`SELECT conname FROM pg_constraint WHERE conname IN ('no_overlapping_freezes', 'freeze_dates_valid');`,
      );
      const conRows = (conRes as any)?.rows || (Array.isArray(conRes) ? conRes : []);
      const existingConstraints = new Set(conRows.map((r: any) => r.conname));

      const hasNoOverlap = existingConstraints.has('no_overlapping_freezes');
      const hasFreezeDatesValid = existingConstraints.has('freeze_dates_valid');

      // 3. Check append-only triggers on immutable tables (Step 7)
      const trigRes = await this.db.execute<{ tgname: string }>(
        sql`SELECT tgname FROM pg_trigger WHERE tgname IN ('audit_logs_immutable', 'invoices_immutable', 'membership_adjustments_immutable', 'check_ins_immutable');`,
      );
      const trigRows = (trigRes as any)?.rows || (Array.isArray(trigRes) ? trigRes : []);
      const existingTriggers = new Set(trigRows.map((r: any) => r.tgname));

      const hasAuditTrigger = existingTriggers.has('audit_logs_immutable');
      const hasInvoiceTrigger = existingTriggers.has('invoices_immutable');
      const hasAdjustmentTrigger = existingTriggers.has('membership_adjustments_immutable');
      const hasCheckInTrigger = existingTriggers.has('check_ins_immutable');

      const missing: string[] = [];
      if (!hasBtreeGist) missing.push("PostgreSQL extension 'btree_gist'");
      if (!hasNoOverlap) missing.push("constraint 'no_overlapping_freezes'");
      if (!hasFreezeDatesValid) missing.push("constraint 'freeze_dates_valid'");
      if (!hasAuditTrigger) missing.push("trigger 'audit_logs_immutable'");
      if (!hasInvoiceTrigger) missing.push("trigger 'invoices_immutable'");
      if (!hasAdjustmentTrigger) missing.push("trigger 'membership_adjustments_immutable'");
      if (!hasCheckInTrigger) missing.push("trigger 'check_ins_immutable'");

      if (missing.length > 0) {
        const errorMsg = `[SchemaGuard] Missing required database schema objects: ${missing.join(', ')}. Please run 'pnpm --filter api db:migrate'.`;
        if (process.env.NODE_ENV === 'production') {
          throw new Error(errorMsg);
        } else {
          this.logger.error(errorMsg);
        }
      } else {
        this.logger.log('✓ Read-only schema guard verified: extensions, freeze constraints, and immutable triggers are active.');
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }
      this.logger.error(`[SchemaGuard] Failed to verify schema constraints: ${err.message}`);
    }
  }
}
