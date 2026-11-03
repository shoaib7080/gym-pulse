import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../common/audit/audit.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Module({
  imports: [DbModule, AuditModule],
  controllers: [ReportsController],
  providers: [ReportsService, ActiveGymGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
