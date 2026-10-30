import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../common/audit/audit.module';
import { FreezesService } from './freezes.service';
import { FreezesController } from './freezes.controller';
import { FreezeSchedulerService } from './freeze-scheduler.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DbModule, AuditModule, SubscriptionsModule],
  controllers: [FreezesController],
  providers: [FreezesService, FreezeSchedulerService],
  exports: [FreezesService, FreezeSchedulerService],
})
export class FreezesModule {}
