import {
  Body,
  Controller,
  Get,
  Param,
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
import { FreezesService } from './freezes.service';
import type { EarlyLiftFreezeInput } from '@gympulse/shared';

@Controller('freezes')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class FreezesController {
  constructor(private readonly freezesService: FreezesService) {}

  /**
   * Run settlement of due freezes for the gym (Daily batch job or on-demand trigger)
   */
  @Post('settle-due')
  @Roles('owner', 'manager')
  async settleDueFreezes(
    @CurrentTenant() tenant: TenantContext,
    @Body() body?: { asOfDate?: string },
  ) {
    return this.freezesService.settleDueFreezesForGym(tenant.gymId, body?.asOfDate);
  }

  /**
   * List freezes across the gym with optional status or membership filtering
   */
  @Get()
  @Roles('owner', 'manager', 'front_desk')
  async listFreezes(
    @CurrentTenant() tenant: TenantContext,
    @Query('status') status?: string,
    @Query('membershipId') membershipId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.freezesService.listFreezes(tenant.gymId, {
      status,
      membershipId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Get single freeze details with proofs and membership context
   */
  @Get(':id')
  @Roles('owner', 'manager', 'front_desk')
  async getFreezeById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') freezeId: string,
  ) {
    return this.freezesService.getFreezeById(tenant.gymId, freezeId);
  }

  /**
   * Approve a pending freeze request (Owner or Manager)
   */
  @Post(':id/approve')
  @Roles('owner', 'manager')
  async approveFreeze(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') freezeId: string,
  ) {
    return this.freezesService.approveFreeze(tenant.gymId, freezeId, user?.id);
  }

  /**
   * Reject a pending freeze request with mandatory explanation (Owner or Manager)
   */
  @Post(':id/reject')
  @Roles('owner', 'manager')
  async rejectFreeze(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') freezeId: string,
    @Body() body: { rejectionReason: string },
  ) {
    return this.freezesService.rejectFreeze(
      tenant.gymId,
      freezeId,
      body.rejectionReason,
      user?.id,
    );
  }

  /**
   * Cancel a scheduled or pending freeze
   */
  @Post(':id/cancel')
  @Roles('owner', 'manager', 'front_desk')
  async cancelFreeze(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') freezeId: string,
  ) {
    return this.freezesService.cancelFreeze(tenant.gymId, freezeId, user?.id);
  }

  /**
   * Early lift an active freeze (Front Desk with manager PIN, or Manager/Owner)
   */
  @Post(':id/lift')
  @Roles('owner', 'manager', 'front_desk')
  async liftFreezeEarly(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') freezeId: string,
    @Body() body: EarlyLiftFreezeInput,
  ) {
    return this.freezesService.liftFreezeEarly(
      tenant.gymId,
      freezeId,
      body,
      user?.id,
      tenant.role,
    );
  }

  /**
   * Attach medical/supporting proof document (Restricted to Owner/Manager)
   */
  @Post(':id/proofs')
  @Roles('owner', 'manager')
  async attachProof(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') freezeId: string,
    @Body()
    body: {
      storageKey: string;
      mimeType?: 'application/pdf' | 'image/jpeg' | 'image/png';
      sizeBytes?: number;
      sha256?: string;
    },
  ) {
    return this.freezesService.attachProof(
      tenant.gymId,
      freezeId,
      body,
      user?.id,
    );
  }

  /**
   * Run background purge of expired proof documents
   */
  @Post('purge-proofs')
  @Roles('owner', 'manager')
  async purgeExpiredProofs(@CurrentTenant() tenant: TenantContext) {
    return this.freezesService.purgeExpiredProofs(tenant.gymId);
  }
}
