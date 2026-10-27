import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import {
  API_PREFIX,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  healthResponseSchema,
  metaResponseSchema,
  type HealthResponse,
  type MetaResponse,
} from '@gympulse/shared';
import { DB, type Database } from './db/db.module';

@Controller()
export class AppController {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Works without a database: use it to check that the API itself is running.
  @Get('meta')
  meta(): MetaResponse {
    return metaResponseSchema.parse({
      name: 'gympulse-api',
      version: '0.0.1',
      apiPrefix: API_PREFIX,
      timezone: DEFAULT_TIMEZONE,
      currency: DEFAULT_CURRENCY,
    });
  }

  // Needs a working DATABASE_URL: use it to check the database connection.
  @Get('health')
  async health(): Promise<HealthResponse> {
    try {
      await this.db.execute(sql`select 1`);
    } catch (error) {
      // Drizzle wraps the driver error, so read the underlying cause when there is one.
      const cause =
        (error as { cause?: { message?: string } }).cause?.message ??
        (error instanceof Error ? error.message : String(error));
      throw new ServiceUnavailableException(`Database connection failed: ${cause}`);
    }
    return healthResponseSchema.parse({
      status: 'ok',
      time: new Date().toISOString(),
    });
  }
}
