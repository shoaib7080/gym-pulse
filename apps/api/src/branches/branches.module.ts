import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';
import { BranchAccessService } from './branch-access.service';

@Module({
  imports: [DbModule, SubscriptionsModule],
  controllers: [BranchesController],
  providers: [BranchesService, BranchAccessService, TenantGuard, AuthGuard, RolesGuard, ActiveGymGuard],
  exports: [BranchesService, BranchAccessService],
})
export class BranchesModule {}
