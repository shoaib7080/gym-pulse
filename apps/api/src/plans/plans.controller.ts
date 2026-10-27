import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PlansService } from './plans.service';
import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Controller('plans')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  /**
   * List active membership plans for the gym
   */
  @Get()
  @Roles('owner', 'manager', 'front_desk')
  async getPlans(
    @CurrentTenant() tenant: TenantContext,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.plansService.getGymPlans(
      tenant.gymId,
      includeInactive === 'true' || includeInactive === '1',
    );
  }

  /**
   * Get single plan with its freeze policy
   */
  @Get(':id')
  @Roles('owner', 'manager', 'front_desk')
  async getPlanById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') planId: string,
  ) {
    return this.plansService.getPlanById(tenant.gymId, planId);
  }

  /**
   * Create a new membership plan (Owner or Manager only, requires active verified gym)
   */
  @Post()
  @UseGuards(ActiveGymGuard)
  @Roles('owner', 'manager')
  async createPlan(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    return this.plansService.createPlan(tenant.gymId, body, user?.id);
  }

  /**
   * Update plan details or status (Owner or Manager only)
   */
  @Patch(':id')
  @Roles('owner', 'manager')
  async updatePlan(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') planId: string,
    @Body() body: unknown,
  ) {
    return this.plansService.updatePlan(tenant.gymId, planId, body, user?.id);
  }

  /**
   * Configure freeze policy for a plan or as gym master default (Owner or Manager only, requires active verified gym)
   */
  @Post('freeze-policy')
  @UseGuards(ActiveGymGuard)
  @Roles('owner', 'manager')
  async configureFreezePolicy(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    return this.plansService.configureFreezePolicy(tenant.gymId, body, user?.id);
  }
}
