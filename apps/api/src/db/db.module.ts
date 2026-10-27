import { Global, Logger, Module, type OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';

export const DB = Symbol('DB');
export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Database => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) {
          // Do not crash: the API still starts so /v1/meta works while you set up the database.
          new Logger('DbModule').warn(
            'DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env and fill it in.',
          );
        }
        // A pool only connects when the first query runs.
        const pool = new Pool({
          connectionString: url,
          ssl: url?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
        });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DbModule implements OnModuleInit {
  private readonly logger = new Logger(DbModule.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  async onModuleInit() {
    try {
      await this.db.execute(sql.raw('CREATE EXTENSION IF NOT EXISTS btree_gist;'));
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_freezes'
          ) THEN
            ALTER TABLE membership_freezes
            ADD CONSTRAINT no_overlapping_freezes
            EXCLUDE USING gist (
              membership_id WITH =,
              daterange(start_date, (end_date + integer '1'), '[]') WITH &&
            )
            WHERE (status IN ('pending_review', 'scheduled', 'active'));
          END IF;
        END $$;
      `));
      this.logger.log('✓ PostgreSQL btree_gist and no_overlapping_freezes exclusion constraint verified.');
    } catch (err: any) {
      this.logger.warn(`Could not verify exclusion constraint on startup: ${err.message}`);
    }
  }
}
