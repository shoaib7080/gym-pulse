import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Module({
  imports: [DbModule],
  controllers: [BranchesController],
  providers: [BranchesService, TenantGuard, AuthGuard, RolesGuard, ActiveGymGuard],
  exports: [BranchesService],
})
export class BranchesModule {}
