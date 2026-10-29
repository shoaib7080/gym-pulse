import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../common/audit/audit.module';
import { FreezesModule } from '../freezes/freezes.module';
import { CheckInService } from './check-in.service';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AccessController } from './access.controller';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DbModule, AuditModule, FreezesModule, SubscriptionsModule],
  controllers: [AttendanceController, AccessController],
  providers: [CheckInService, AttendanceService],
  exports: [CheckInService, AttendanceService],
})
export class AttendanceModule {}
