import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { BranchesModule } from './branches/branches.module';
import { PlatformModule } from './platform/platform.module';
import { AuditModule } from './common/audit/audit.module';
import { MembersModule } from './members/members.module';
import { PlansModule } from './plans/plans.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ShiftsModule } from './shifts/shifts.module';
import { PaymentsModule } from './payments/payments.module';
import { EmailModule } from './common/email/email.module';
import { FreezesModule } from './freezes/freezes.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ReportsModule } from './reports/reports.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { OutboxModule } from './outbox/outbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Always read apps/api/.env, whichever folder the command was started from.
      envFilePath: [resolve(__dirname, '..', '.env'), '.env'],
    }),
    DbModule,
    AuditModule,
    EmailModule,
    AuthModule,
    TenancyModule,
    BranchesModule,
    MembersModule,
    PlansModule,
    MembershipsModule,
    FreezesModule,
    AttendanceModule,
    ShiftsModule,
    PaymentsModule,
    ReportsModule,
    SubscriptionsModule,
    OutboxModule,
    PlatformModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
