import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Module({
  imports: [DbModule],
  controllers: [MembersController],
  providers: [MembersService, ActiveGymGuard],
  exports: [MembersService],
})
export class MembersModule {}
