import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DbModule, SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ActiveGymGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
