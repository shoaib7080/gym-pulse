import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../common/audit/audit.module';
import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { FreezesModule } from '../freezes/freezes.module';
import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Module({
  imports: [DbModule, AuditModule, FreezesModule],
  controllers: [MembershipsController],
  providers: [MembershipsService, ActiveGymGuard],
  exports: [MembershipsService],
})
export class MembershipsModule {}
