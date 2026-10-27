import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformRolesGuard } from '../common/guards/platform-roles.guard';
import { PlatformRoles } from '../common/decorators/platform-roles.decorator';
import { CurrentPlatformAdmin, type PlatformAdminContext } from '../common/decorators/current-platform-admin.decorator';
import { PlatformService } from './platform.service';

@Controller('platform')
@UseGuards(AuthGuard, PlatformAdminGuard, PlatformRolesGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  /**
   * Platform Overview: Overall SaaS metrics (gyms, branches, members, admins)
   * Accessible by: superadmin, support, auditor
   */
  @Get('overview')
  @PlatformRoles('superadmin', 'support', 'auditor')
  async getOverview() {
    return this.platformService.getOverview();
  }

  /**
   * List all gyms across the entire platform
   * Accessible by: superadmin only
   */
  @Get('gyms')
  @PlatformRoles('superadmin')
  async getGyms(
    @Query('status') status?: 'pending_verification' | 'active' | 'suspended' | 'closed',
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformService.getGyms({ status, search, page, limit });
  }

  /**
   * Get single gym details (branches, staff, member count, license info)
   * Returns counts, not member lists.
   * Accessible by: superadmin only
   */
  @Get('gyms/:id')
  @PlatformRoles('superadmin')
  async getGymById(@Param('id') gymId: string) {
    return this.platformService.getGymById(gymId);
  }

  /**
   * Platform Verification Review Queue:
   * View all gyms pending verification with their trade license, TRN, and uploaded documents
   * Accessible by: superadmin only
   */
  @Get('review-queue')
  @PlatformRoles('superadmin')
  async getReviewQueue() {
    return this.platformService.getReviewQueue();
  }

  @Get('gyms/review-queue')
  @PlatformRoles('superadmin')
  async getGymsReviewQueue() {
    return this.platformService.getReviewQueue();
  }

  /**
   * Approve a pending gym verification
   * Accessible by: superadmin only
   */
  @Post('gyms/:id/approve')
  @PlatformRoles('superadmin')
  async approveGym(
    @Param('id') gymId: string,
    @Body() body: { reason?: string; notes?: string },
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
  ) {
    return this.platformService.approveGym(gymId, body, admin?.id);
  }

  /**
   * Reject a gym verification (reason required)
   * Accessible by: superadmin only
   */
  @Post('gyms/:id/reject')
  @PlatformRoles('superadmin')
  async rejectGym(
    @Param('id') gymId: string,
    @Body() body: { reason: string },
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
  ) {
    return this.platformService.rejectGym(gymId, body, admin?.id);
  }

  /**
   * Suspend an active gym (reason required)
   * Accessible by: superadmin only
   */
  @Post('gyms/:id/suspend')
  @PlatformRoles('superadmin')
  async suspendGym(
    @Param('id') gymId: string,
    @Body() body: { reason: string },
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
  ) {
    return this.platformService.suspendGym(gymId, body, admin?.id);
  }

  /**
   * Reactivate a suspended gym (reason required)
   * Accessible by: superadmin only
   */
  @Post('gyms/:id/reactivate')
  @PlatformRoles('superadmin')
  async reactivateGym(
    @Param('id') gymId: string,
    @Body() body: { reason: string },
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
  ) {
    return this.platformService.reactivateGym(gymId, body, admin?.id);
  }

  /**
   * List all platform administrators
   * Accessible by: superadmin only
   */
  @Get('admins')
  @PlatformRoles('superadmin')
  async getPlatformAdmins() {
    return this.platformService.getPlatformAdmins();
  }

  /**
   * Grant platform admin privileges to another user by email (reason required)
   * Accessible by: superadmin only
   */
  @Post('admins')
  @PlatformRoles('superadmin')
  async addPlatformAdmin(
    @Body() body: { email: string; role?: 'superadmin' | 'support' | 'auditor'; reason: string },
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
  ) {
    return this.platformService.addPlatformAdmin({
      ...body,
      inviterAdminId: admin?.id,
    });
  }

  /**
   * Deactivate / Reactivate a platform administrator
   * Accessible by: superadmin only
   */
  @Patch('admins/:id/status')
  @PlatformRoles('superadmin')
  async setAdminStatus(
    @Param('id') adminId: string,
    @Body('isActive') isActive: boolean,
    @Body('reason') reason?: string,
    @CurrentPlatformAdmin() admin?: PlatformAdminContext,
  ) {
    return this.platformService.setAdminActiveStatus(adminId, Boolean(isActive), reason, admin?.id);
  }

  /**
   * Platform-wide tamper-evident audit trail & cryptographic verification
   * Accessible by: superadmin, support, auditor
   */
  @Get('audit-logs')
  @PlatformRoles('superadmin', 'support', 'auditor')
  async getPlatformAuditLogs(@Query('limit') limit?: number) {
    return this.platformService.getPlatformAuditLogs(limit ? Number(limit) : 100);
  }
}

