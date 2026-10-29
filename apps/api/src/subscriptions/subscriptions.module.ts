import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [DbModule, AuditModule],
  controllers: [SubscriptionsController, PlatformSubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
