import {
  Body,
  Controller,
  Get,
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
import { AttendanceService, type MarkAttendanceDto } from './attendance.service';

@Controller('attendance')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Tap to mark attendance (from member app or front desk)
   */
  @Post('tap')
  @Roles('owner', 'manager', 'front_desk')
  async tapAttendance(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: MarkAttendanceDto,
  ) {
    return this.attendanceService.tapAttendance(tenant.gymId, body, user?.id);
  }

  /**
   * Get attendance history for the gym with optional member or branch filters
   */
  @Get('history')
  @Roles('owner', 'manager', 'front_desk')
  async getAttendanceHistory(
    @CurrentTenant() tenant: TenantContext,
    @Query('memberId') memberId?: string,
    @Query('membershipId') membershipId?: string,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.attendanceService.getAttendanceHistory(tenant.gymId, {
      memberId,
      membershipId,
      branchId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
