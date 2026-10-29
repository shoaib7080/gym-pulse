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
import { OutboxService } from './outbox.service';

@Controller('outbox')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class OutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  /**
   * Enqueue a transactional notification for delivery (e.g. freeze confirmation, receipt)
   * Accessible by: owner, manager
   */
  @Post('enqueue')
  @Roles('owner', 'manager')
  async enqueue(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: { id: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.outboxService.enqueue(
      {
        ...body,
        gymId: tenant.gymId,
      },
      user?.id,
    );
  }

  /**
   * List notifications in current gym's notification outbox
   * Accessible by: owner, manager
   */
  @Get()
  @Roles('owner', 'manager')
  async getGymOutbox(
    @CurrentTenant() tenant: TenantContext,
    @Query('status') status?: 'pending' | 'sent' | 'failed' | 'dead',
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.outboxService.getOutboxItems({
      gymId: tenant.gymId,
      status,
      channel,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }
}
