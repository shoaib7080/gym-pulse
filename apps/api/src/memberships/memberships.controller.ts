import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  MembershipsService,
  type CreateMembershipDto,
  type AdjustMembershipDto,
  type RenewMembershipDto,
  type CancelMembershipDto,
} from './memberships.service';
import { FreezesService } from '../freezes/freezes.service';
import { ActiveGymGuard } from '../common/guards/active-gym.guard';
import type { CreateFreezeInput, FreezePreviewInput } from '@gympulse/shared';

@Controller('memberships')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class MembershipsController {
  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly freezesService: FreezesService,
  ) {}

  /**
   * Provision a membership for a member (Requires active verified gym)
   */
  @Post()
  @UseGuards(ActiveGymGuard)
  @Roles('owner', 'manager', 'front_desk')
  async createMembership(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: CreateMembershipDto,
  ) {
    return this.membershipsService.createMembership(tenant.gymId, body, user?.id);
  }

  /**
   * Get membership details with audit adjustment ledger
   */
  @Get(':id')
  @Roles('owner', 'manager', 'front_desk')
  async getMembershipById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') membershipId: string,
  ) {
    return this.membershipsService.getMembershipById(tenant.gymId, membershipId);
  }

  /**
   * Adjust membership dates with mandatory justification (Owner or Manager only)
   */
  @Post(':id/adjust')
  @Roles('owner', 'manager')
  async adjustMembership(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') membershipId: string,
    @Body() body: AdjustMembershipDto,
  ) {
    return this.membershipsService.adjustMembership(tenant.gymId, membershipId, body, user?.id);
  }

  /**
   * Evaluate all 10 eligibility checks & remaining quota for freezing (Spec Section 7.2)
   */
  @Get(':id/freeze-eligibility')
  @Roles('owner', 'manager', 'front_desk')
  async getFreezeEligibility(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') membershipId: string,
  ) {
    return this.freezesService.checkFreezeEligibility(tenant.gymId, membershipId);
  }

  /**
   * Preview a proposed freeze with inclusive date math (Spec Section 7.4)
   */
  @Post(':id/freezes/preview')
  @Roles('owner', 'manager', 'front_desk')
  async previewFreeze(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') membershipId: string,
    @Body() body: FreezePreviewInput,
  ) {
    return this.freezesService.previewFreeze(tenant.gymId, membershipId, body);
  }

  /**
   * Request/execute a membership freeze (Spec Section 7.3)
   */
  @Post(':id/freezes')
  @Roles('owner', 'manager', 'front_desk')
  async createFreeze(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') membershipId: string,
    @Body() body: Omit<CreateFreezeInput, 'membershipId'>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.freezesService.createFreeze(
      tenant.gymId,
      membershipId,
      { ...body, membershipId },
      user?.id,
      tenant.role,
      idempotencyKey,
    );
  }

  /**
   * Renew membership with date continuity (Spec Section 6.3)
   */
  @Post(':id/renew')
  @Roles('owner', 'manager', 'front_desk')
  async renewMembership(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') membershipId: string,
    @Body() body: RenewMembershipDto,
  ) {
    return this.membershipsService.renewMembership(tenant.gymId, membershipId, body, user?.id);
  }

  /**
   * Cancel membership with mandatory reason and effective date (Spec Section 6.4)
   */
  @Post(':id/cancel')
  @Roles('owner', 'manager')
  async cancelMembership(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') membershipId: string,
    @Body() body: CancelMembershipDto,
  ) {
    return this.membershipsService.cancelMembership(tenant.gymId, membershipId, body, user?.id);
  }
}
