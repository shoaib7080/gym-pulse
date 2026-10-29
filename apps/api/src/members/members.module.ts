import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DbModule, SubscriptionsModule],
  controllers: [MembersController],
  providers: [MembersService, ActiveGymGuard],
  exports: [MembersService],
})
export class MembersModule {}
