import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { BranchesService } from './branches.service';

import { AllowInactiveGym } from '../common/decorators/allow-inactive-gym.decorator';
import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Controller('branches')
@UseGuards(AuthGuard, TenantGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /**
   * List all branches for the active gym
   */
  @Get()
  @AllowInactiveGym()
  async getBranches(@CurrentTenant() tenant: TenantContext) {
    return this.branchesService.getGymBranches(tenant.gymId);
  }

  /**
   * Get single branch details
   */
  @Get(':id')
  @AllowInactiveGym()
  async getBranch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') branchId: string,
  ) {
    const branch = await this.branchesService.getBranchById(tenant.gymId, branchId);
    if (!branch) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Branch not found',
      });
    }
    return branch;
  }

  /**
   * Create a new branch (Owner or Manager only, requires active verified gym)
   */
  @Post()
  @UseGuards(RolesGuard, ActiveGymGuard)
  @Roles('owner', 'manager')
  async createBranch(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    return this.branchesService.createBranch(tenant.gymId, body, user?.id);
  }

  /**
   * Update an existing branch (Owner or Manager only)
   */
  @Patch(':id')
  @UseGuards(RolesGuard, ActiveGymGuard)
  @Roles('owner', 'manager')
  async updateBranch(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') branchId: string,
    @Body() body: unknown,
  ) {
    return this.branchesService.updateBranch(tenant.gymId, branchId, body, user?.id);
  }
}
