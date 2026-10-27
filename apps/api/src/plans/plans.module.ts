import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Module({
  imports: [DbModule],
  controllers: [PlansController],
  providers: [PlansService, ActiveGymGuard],
  exports: [PlansService],
})
export class PlansModule {}
