import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformRolesGuard } from '../common/guards/platform-roles.guard';
import { AuthGuard } from '../common/guards/auth.guard';

@Module({
  imports: [DbModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformAdminGuard, PlatformRolesGuard, AuthGuard],
  exports: [PlatformService],
})
export class PlatformModule {}
