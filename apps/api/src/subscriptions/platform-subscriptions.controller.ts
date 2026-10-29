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
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformRolesGuard } from '../common/guards/platform-roles.guard';
import { PlatformRoles } from '../common/decorators/platform-roles.decorator';
import { CurrentPlatformAdmin, type PlatformAdminContext } from '../common/decorators/current-platform-admin.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('platform')
@UseGuards(AuthGuard, PlatformAdminGuard, PlatformRolesGuard)
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * List all available SaaS plans
   * Accessible by: superadmin, support, auditor
   */
  @Get('saas-plans')
  @PlatformRoles('superadmin', 'support', 'auditor')
  async listPlans() {
    return this.subscriptionsService.listPlans();
  }

  /**
   * Create a new SaaS pricing tier
   * Accessible by: superadmin
   */
  @Post('saas-plans')
  @PlatformRoles('superadmin')
  async createPlan(
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Body() body: unknown,
  ) {
    return this.subscriptionsService.createPlan(body, admin.userId || admin.id);
  }

  /**
   * Provision or assign a SaaS subscription to a gym (generates initial platform invoice)
   * Accessible by: superadmin
   */
  @Post('subscriptions')
  @PlatformRoles('superadmin')
  async provisionSubscription(
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Body() body: unknown,
  ) {
    return this.subscriptionsService.provisionSubscription(body, admin.userId || admin.id);
  }

  /**
   * Run automated dunning evaluation sweep
   * Accessible by: superadmin
   */
  @Post('subscriptions/sweep')
  @PlatformRoles('superadmin')
  async runSweep(@Body() body: { asOfDate?: string }) {
    return this.subscriptionsService.runSubscriptionSweep(body?.asOfDate);
  }

  /**
   * List platform tax invoices across all gyms
   * Accessible by: superadmin, auditor
   */
  @Get('invoices')
  @PlatformRoles('superadmin', 'auditor')
  async getPlatformInvoices(
    @Query('gymId') gymId?: string,
    @Query('isPaid') isPaid?: string,
  ) {
    const isPaidBool = isPaid === 'true' ? true : isPaid === 'false' ? false : undefined;
    return this.subscriptionsService.getPlatformInvoices({ gymId, isPaid: isPaidBool });
  }

  /**
   * Record payment for a platform invoice (lifts restrictions immediately if fully paid)
   * Accessible by: superadmin
   */
  @Post('invoices/:id/payments')
  @PlatformRoles('superadmin')
  async recordPayment(
    @Param('id') invoiceId: string,
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Body() body: unknown,
  ) {
    return this.subscriptionsService.recordInvoicePayment(invoiceId, body, admin.userId || admin.id);
  }
}
