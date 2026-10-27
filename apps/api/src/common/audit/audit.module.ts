import { Global, Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [DbModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
