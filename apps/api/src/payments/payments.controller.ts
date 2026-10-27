import {
  Body,
  Controller,
  Get,
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
import { PaymentsService } from './payments.service';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Controller('payments')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Process a front desk payment sale (Cash, POS Card, Bank Transfer) - Requires active verified gym
   * Generates sequential gapless tax invoice and activates membership
   */
  @Post('desk')
  @UseGuards(ActiveGymGuard)
  @Roles('owner', 'manager', 'front_desk')
  async createDeskPayment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    return this.paymentsService.createDeskPayment(tenant.gymId, body, user?.id);
  }

  /**
   * Get payment details and attached invoice
   */
  @Get(':id')
  @Roles('owner', 'manager', 'front_desk')
  async getPaymentById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') paymentId: string,
  ) {
    return this.paymentsService.getPaymentById(tenant.gymId, paymentId);
  }

  /**
   * Void a payment (Owner or Manager only)
   */
  @Post(':id/void')
  @Roles('owner', 'manager')
  async voidPayment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') paymentId: string,
    @Body() body: unknown,
  ) {
    return this.paymentsService.voidPayment(tenant.gymId, paymentId, body, user?.id);
  }
}
