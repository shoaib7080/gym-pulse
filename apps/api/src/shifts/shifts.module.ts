import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';

@Module({
  imports: [DbModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
