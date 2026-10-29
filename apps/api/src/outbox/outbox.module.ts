import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxController } from './outbox.controller';
import { PlatformOutboxController } from './platform-outbox.controller';
import { DbModule } from '../db/db.module';
import { EmailModule } from '../common/email/email.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [DbModule, EmailModule, AuditModule],
  controllers: [OutboxController, PlatformOutboxController],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
