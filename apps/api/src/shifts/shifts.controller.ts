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
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  /**
   * Open a cashier shift with opening cash float
   */
  @Post('open')
  @Roles('owner', 'manager', 'front_desk')
  async openShift(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    return this.shiftsService.openShift(tenant.gymId, user.id, body);
  }

  /**
   * Get currently active open shift for staff member
   */
  @Get('current')
  @Roles('owner', 'manager', 'front_desk')
  async getCurrentShift(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
  ) {
    return this.shiftsService.getCurrentShift(tenant.gymId, user.id);
  }

  /**
   * Close active cashier shift and reconcile cash
   */
  @Post(':id/close')
  @Roles('owner', 'manager', 'front_desk')
  async closeShift(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') shiftId: string,
    @Body() body: unknown,
  ) {
    return this.shiftsService.closeShift(tenant.gymId, shiftId, user.id, body);
  }

  /**
   * List shifts for gym with filters (Owner or Manager only)
   */
  @Get()
  @Roles('owner', 'manager')
  async listShifts(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('openedBy') openedBy?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.shiftsService.listShifts(tenant.gymId, {
      branchId,
      status,
      openedBy,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Approve a shift closeout variance (Owner or Manager only)
   */
  @Post(':id/approve')
  @Roles('owner', 'manager')
  async approveShiftVariance(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') shiftId: string,
    @Body() body: unknown,
  ) {
    return this.shiftsService.approveShiftVariance(
      tenant.gymId,
      shiftId,
      user.id,
      tenant.role,
      body,
    );
  }

  /**
   * Get shift details and payments
   */
  @Get(':id')
  @Roles('owner', 'manager')
  async getShiftById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') shiftId: string,
  ) {
    return this.shiftsService.getShiftById(tenant.gymId, shiftId);
  }
}
