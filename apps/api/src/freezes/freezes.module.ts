import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../common/audit/audit.module';
import { FreezesService } from './freezes.service';
import { FreezesController } from './freezes.controller';

@Module({
  imports: [DbModule, AuditModule],
  controllers: [FreezesController],
  providers: [FreezesService],
  exports: [FreezesService],
})
export class FreezesModule {}
