import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformRolesGuard } from '../common/guards/platform-roles.guard';
import { PlatformRoles } from '../common/decorators/platform-roles.decorator';
import { OutboxService } from './outbox.service';

@Controller('platform/outbox')
@UseGuards(AuthGuard, PlatformAdminGuard, PlatformRolesGuard)
export class PlatformOutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  /**
   * Dispatch pending outbox notifications across all gyms
   * Accessible by: superadmin
   */
  @Post('dispatch')
  @PlatformRoles('superadmin')
  async dispatch(@Body() body: { limit?: number }) {
    return this.outboxService.dispatchPending(body?.limit || 50);
  }

  /**
   * List platform-wide notification outbox items with status filters
   * Accessible by: superadmin, support
   */
  @Get()
  @PlatformRoles('superadmin', 'support')
  async getOutboxItems(
    @Query('gymId') gymId?: string,
    @Query('status') status?: 'pending' | 'sent' | 'failed' | 'dead',
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.outboxService.getOutboxItems({
      gymId,
      status,
      channel,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }
}
