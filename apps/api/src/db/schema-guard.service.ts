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
   * Runs SELECT queries to confirm required extensions and constraints exist without needing DDL privileges.
   */
  async verifySchema() {
    try {
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

      const missing: string[] = [];
      if (!hasBtreeGist) missing.push("PostgreSQL extension 'btree_gist'");
      if (!hasNoOverlap) missing.push("constraint 'no_overlapping_freezes'");
      if (!hasFreezeDatesValid) missing.push("constraint 'freeze_dates_valid'");

      if (missing.length > 0) {
        const errorMsg = `[SchemaGuard] Missing required database schema objects: ${missing.join(', ')}. Please run 'pnpm --filter api db:migrate'.`;
        if (process.env.NODE_ENV === 'production') {
          throw new Error(errorMsg);
        } else {
          this.logger.error(errorMsg);
        }
      } else {
        this.logger.log('✓ Read-only schema guard verified: btree_gist extension and freeze constraints are active.');
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }
      this.logger.error(`[SchemaGuard] Failed to verify schema constraints: ${err.message}`);
    }
  }
}
