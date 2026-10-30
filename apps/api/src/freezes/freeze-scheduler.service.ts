import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { FreezesService } from './freezes.service';

@Injectable()
export class FreezeSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FreezeSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  // Run automated settlement every 1 hour (3600000 ms)
  private readonly intervalMs = 60 * 60 * 1000;

  constructor(private readonly freezesService: FreezesService) {}

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
   */
  async runDailySweep(asOfDate?: string) {
    this.logger.log(`[FreezeScheduler] Executing automated freeze settlement & proof purge sweep...`);
    const settlementResult = await this.freezesService.settleDueFreezesForAllGyms(asOfDate);
    const purgeResult = await this.freezesService.purgeExpiredProofsForAllGyms();

    this.logger.log(
      `[FreezeScheduler] Sweep completed. Processed ${settlementResult.totalGymsProcessed} gyms, purged ${purgeResult.totalPurged} expired proofs.`,
    );

    return {
      settlement: settlementResult,
      purge: purgeResult,
    };
  }
}
