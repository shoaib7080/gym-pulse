import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscription')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Get current gym's SaaS subscription, plan details, tier limits, and dunning status
   * Accessible by: owner, manager
   */
  @Get()
  @Roles('owner', 'manager')
  async getSubscription(@CurrentTenant() tenant: TenantContext) {
    return this.subscriptionsService.getGymSubscription(tenant.gymId);
  }

  /**
   * List platform tax invoices issued to this gym
   * Accessible by: owner, manager
   */
  @Get('invoices')
  @Roles('owner', 'manager')
  async getInvoices(@CurrentTenant() tenant: TenantContext) {
    return this.subscriptionsService.getGymInvoices(tenant.gymId);
  }

  /**
   * Request subscription plan upgrade or change
   * Accessible by: owner only
   */
  @Post('change')
  @Roles('owner')
  async changeSubscription(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    return this.subscriptionsService.changeSubscription(tenant.gymId, body, user?.id);
  }
}
