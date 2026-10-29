import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DB, type Database } from './db.tokens';
import { SchemaGuard } from './schema-guard.service';

export { DB, type Database } from './db.tokens';

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
          console.warn(
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
    SchemaGuard,
  ],
  exports: [DB, SchemaGuard],
})
export class DbModule {}

