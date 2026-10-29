import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CheckInService } from './check-in.service';
import type { MemberCheckInAttemptEvent } from './check-in.types';

export interface SelfTapDto {
  memberId?: string;
  membershipId?: string;
  branchId?: string;
  deviceId?: string;
}

/**
 * Access Ingress Transport Adapter (Spec Requirement 1)
 * Decoupled controller acting solely as an ingress transport adapter.
 * Emits standardized MemberCheckInAttemptEvent to CheckInService.
 */
@Controller('access')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AccessController {
  constructor(private readonly checkInService: CheckInService) {}

  /**
   * Endpoint: POST /v1/access/self-tap
   * Temporary Stopgap in-app attendance logger for members.
   * Emits MemberCheckInAttemptEvent with method = 'self_tap_temporary'.
   */
  @Post('self-tap')
  @Roles('owner', 'manager', 'front_desk')
  async selfTap(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: SelfTapDto,
    @Req() req: Request,
  ) {
    const event: MemberCheckInAttemptEvent = {
      gymId: tenant.gymId,
      memberId: body.memberId,
      membershipId: body.membershipId,
      branchId: body.branchId,
      actorUserId: user?.id,
      method: 'self_tap_temporary',
      timestamp: new Date(),
      sourceIp: req.ip || req.socket.remoteAddress,
      deviceId: body.deviceId,
    };

    return this.checkInService.processCheckIn(event);
  }
}
