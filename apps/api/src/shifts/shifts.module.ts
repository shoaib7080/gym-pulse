import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Module({
  imports: [DbModule],
  controllers: [ShiftsController],
  providers: [ShiftsService, ActiveGymGuard],
  exports: [ShiftsService],
})
export class ShiftsModule {}
