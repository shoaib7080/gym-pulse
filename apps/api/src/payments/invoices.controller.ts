import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AllowInactiveGym } from '../common/decorators/allow-inactive-gym.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { PaymentsService } from './payments.service';

@Controller('invoices')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * List all member tax invoices, credit notes, and sandbox demo receipts
   * Supports filtering by docType, series, search query, and date range
   */
  @Get()
  @AllowInactiveGym()
  @Roles('owner', 'manager', 'front_desk')
  async listInvoices(
    @CurrentTenant() tenant: TenantContext,
    @Query('docType') docType?: string,
    @Query('series') series?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.paymentsService.listInvoices(tenant.gymId, {
      docType,
      series,
      search,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Get invoice details by ID
   */
  @Get(':id')
  @AllowInactiveGym()
  @Roles('owner', 'manager', 'front_desk')
  async getInvoiceById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') invoiceId: string,
  ) {
    return this.paymentsService.getInvoiceById(tenant.gymId, invoiceId);
  }

  /**
   * Obtain presigned S3 download URL for an invoice PDF
   * (Complies with UAE data residency and FTA retention rules)
   */
  @Get(':id/pdf')
  @AllowInactiveGym()
  @Roles('owner', 'manager', 'front_desk')
  async getInvoicePdf(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') invoiceId: string,
  ) {
    return this.paymentsService.getInvoicePdf(tenant.gymId, invoiceId);
  }
}
