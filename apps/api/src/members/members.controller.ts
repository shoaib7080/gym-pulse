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
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MembersService } from './members.service';

import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Controller('members')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * Register a new member in the gym (Requires active verified gym)
   * Accessible by Owner, Manager, and Front Desk
   */
  @Post()
  @UseGuards(ActiveGymGuard)
  @Roles('owner', 'manager', 'front_desk')
  async createMember(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    return this.membersService.createMember(tenant.gymId, body, user?.id);
  }

  /**
   * List and search members in the gym
   * Accessible by Owner, Manager, and Front Desk
   */
  @Get()
  @Roles('owner', 'manager', 'front_desk')
  async getMembers(
    @CurrentTenant() tenant: TenantContext,
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: 'active' | 'archived',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.membersService.getMembers(tenant.gymId, {
      search,
      branchId,
      status,
      page,
      limit,
    });
  }

  /**
   * Get member profile details by ID
   */
  @Get(':id')
  @Roles('owner', 'manager', 'front_desk')
  async getMemberById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') memberId: string,
  ) {
    return this.membersService.getMemberById(tenant.gymId, memberId);
  }

  /**
   * Update member profile
   */
  @Patch(':id')
  @Roles('owner', 'manager', 'front_desk')
  async updateMember(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') memberId: string,
    @Body() body: unknown,
  ) {
    return this.membersService.updateMember(tenant.gymId, memberId, body, user?.id);
  }

  /**
   * Archive a member (Owner or Manager only)
   */
  @Post(':id/archive')
  @Roles('owner', 'manager')
  async archiveMember(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Param('id') memberId: string,
  ) {
    return this.membersService.archiveMember(tenant.gymId, memberId, user?.id);
  }
}
