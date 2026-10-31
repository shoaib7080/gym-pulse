import {
  Body,
  Controller,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ActiveGymGuard } from '../common/guards/active-gym.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ActiveGymGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  /**
   * Atomic, server-priced new membership sale
   * Requires Idempotency-Key header.
   */
  @Post('memberships')
  @Roles('owner', 'manager', 'front_desk')
  async sellMembership(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.salesService.sellMembership(
      tenant.gymId,
      body,
      user?.id,
      tenant.role,
      idempotencyKey,
    );
  }

  /**
   * Consolidated, server-priced membership renewal
   * Requires Idempotency-Key header.
   */
  @Post('renewals')
  @Roles('owner', 'manager', 'front_desk')
  async renewMembership(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.salesService.renewMembership(
      tenant.gymId,
      body,
      user?.id,
      tenant.role,
      idempotencyKey,
    );
  }
}
