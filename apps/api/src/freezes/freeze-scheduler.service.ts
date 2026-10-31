import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import { FreezesService } from './freezes.service';

@Injectable()
export class FreezeSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FreezeSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  // Run automated settlement every 1 hour (3600000 ms)
  private readonly intervalMs = 60 * 60 * 1000;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly freezesService: FreezesService,
  ) {}

  onModuleInit() {
    if (process.env.DISABLE_SCHEDULER === 'true') {
      this.logger.log('Freeze automated scheduler is disabled via DISABLE_SCHEDULER=true');
      return;
    }

    this.logger.log('✓ Initialized automated FreezeSchedulerService (hourly sweep & proof purge)');

    // Schedule periodic sweep
    this.timer = setInterval(() => {
      this.runDailySweep().catch((err) => {
        this.logger.error(`Automated freeze sweep failed: ${err?.message}`);
      });
    }, this.intervalMs);

    // Initial sweep triggered 5 seconds after startup to ensure DB readiness
    setTimeout(() => {
      this.runDailySweep().catch((err) => {
        this.logger.error(`Initial automated freeze sweep failed: ${err?.message}`);
      });
    }, 5000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Internal job runner executing automated freeze activation, completion, and proof purge
   * Uses cluster-wide PostgreSQL session advisory lock to ensure single execution.
   */
  async runDailySweep(asOfDate?: string) {
    // Attempt non-blocking cluster advisory lock
    const lockRes = await this.db.execute<{ locked: boolean }>(
      sql`SELECT pg_try_advisory_lock(hashtextextended('freeze_settlement_scheduler', 0)) AS locked`,
    );
    const hasLock = Boolean(lockRes.rows?.[0]?.locked ?? (lockRes as any)?.[0]?.locked);

    if (!hasLock) {
      this.logger.log(
        '[FreezeScheduler] Another worker holds the advisory lock; skipping sweep.',
      );
      return { skipped: true, reason: 'LOCKED_BY_ANOTHER_WORKER' };
    }

    try {
      this.logger.log(`[FreezeScheduler] Acquired lock. Executing automated freeze settlement & proof purge sweep...`);
      const settlementResult = await this.freezesService.settleDueFreezesForAllGyms(asOfDate);
      const purgeResult = await this.freezesService.purgeExpiredProofsForAllGyms(asOfDate);

      this.logger.log(
        `[FreezeScheduler] Sweep completed. Processed ${settlementResult.totalGymsProcessed} gyms, purged ${purgeResult.totalPurged} expired proofs.`,
      );

      return {
        settlement: settlementResult,
        purge: purgeResult,
      };
    } finally {
      try {
        await this.db.execute(
          sql`SELECT pg_advisory_unlock(hashtextextended('freeze_settlement_scheduler', 0))`,
        );
      } catch (unlockErr: any) {
        this.logger.warn(`Failed releasing advisory lock: ${unlockErr?.message}`);
      }
    }
  }
}
