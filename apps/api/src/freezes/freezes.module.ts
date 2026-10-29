import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../common/audit/audit.module';
import { FreezesService } from './freezes.service';
import { FreezesController } from './freezes.controller';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DbModule, AuditModule, SubscriptionsModule],
  controllers: [FreezesController],
  providers: [FreezesService],
  exports: [FreezesService],
})
export class FreezesModule {}
