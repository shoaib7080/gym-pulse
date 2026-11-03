import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { AllowInactiveGym } from '../common/decorators/allow-inactive-gym.decorator';
import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Controller('reports')
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ActiveGymGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Cash Control & Staff Anomaly Audit Reports (Owner or Manager only)
   * Detects drawer closeout variances, complimentary extensions, voids, and overrides
   */
  @Get('anomalies')
  @Roles('owner', 'manager')
  async getCashAndAuditAnomalies(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
    @Query('staffUserId') staffUserId?: string,
  ) {
    return this.reportsService.getCashAndAuditAnomalies(
      tenant.gymId,
      {
        startDate,
        endDate,
        branchId,
        staffUserId,
      },
      user?.id,
    );
  }

  /**
   * Executive Revenue Report (Gross, 5% UAE VAT, Net, Payment Method breakdown)
   * Accessible by: owner, manager
   */
  @Get('revenue')
  @AllowInactiveGym()
  @Roles('owner', 'manager')
  async getRevenueReport(
    @CurrentTenant() tenant: TenantContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.getRevenueReport(tenant.gymId, {
      startDate,
      endDate,
      branchId,
    });
  }

  /**
   * Check-in Analytics & Heatmap (Peak hours, allow/deny ratios, transport methods)
   * Accessible by: owner, manager
   */
  @Get('checkins')
  @Roles('owner', 'manager')
  async getCheckInsReport(
    @CurrentTenant() tenant: TenantContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.getCheckInsReport(tenant.gymId, {
      startDate,
      endDate,
      branchId,
    });
  }

  /**
   * Manual Adjustments & Staff Correction Logs (Complimentary vs system corrections)
   * Accessible by: owner, manager
   */
  @Get('manual-adjustments')
  @Roles('owner', 'manager')
  async getManualAdjustmentsReport(
    @CurrentTenant() tenant: TenantContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('staffUserId') staffUserId?: string,
  ) {
    return this.reportsService.getManualAdjustmentsReport(tenant.gymId, {
      startDate,
      endDate,
      staffUserId,
    });
  }

  /**
   * Real-time Gym Floor Occupancy & Operational Desk Telemetry (90-Minute Rolling Decay)
   * Accessible by: owner, manager, front_desk (Staff operations view - 100% zero financial telemetry)
   */
  @Get('occupancy')
  @AllowInactiveGym()
  @Roles('owner', 'manager', 'front_desk')
  async getOccupancyReport(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.getOccupancyReport(tenant.gymId, branchId);
  }
}
