import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant, type TenantContext } from '../common/decorators/current-tenant.decorator';
import { TenancyService } from './tenancy.service';

@Controller('gyms')
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  /**
   * Route 1: Onboard a new Gym
   * Authenticated user creates a gym and becomes its 'owner'.
   */
  @Post()
  @UseGuards(AuthGuard)
  async createGym(
    @CurrentUser() user: { id: string; email: string; name: string },
    @Body() body: unknown,
  ) {
    return this.tenancyService.createGym(user, body);
  }

  /**
   * Route 2: List all gyms the current user belongs to (as owner, manager, or front_desk)
   * Useful in Postman or frontend to pick a gym and get its ID.
   */
  @Get('my-gyms')
  @UseGuards(AuthGuard)
  async getMyGyms(@CurrentUser() user: { id: string }) {
    return this.tenancyService.getUserGyms(user.id);
  }

  /**
   * Route 3: Get current gym profile and branches
   * Requires both AuthGuard and TenantGuard (x-gym-id header).
   */
  @Get('current')
  @UseGuards(AuthGuard, TenantGuard)
  async getCurrentGym(@CurrentTenant() tenant: TenantContext) {
    const gym = await this.tenancyService.getGymDetails(tenant.gymId);
    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }
    return {
      ...gym,
      yourRole: tenant.role,
      yourBranchScope: tenant.branchScope,
    };
  }

  /**
   * Route 3b: Update gym profile (Allowed while pending verification)
   * Owner and Manager only.
   */
  @Patch('profile')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'manager')
  async updateProfile(
    @CurrentUser() user: { id: string },
    @CurrentTenant() tenant: TenantContext,
    @Body() body: unknown,
  ) {
    return this.tenancyService.updateGymProfile(tenant.gymId, body, user.id);
  }

  /**
   * Route 3c: Register / upload verification document (Allowed while pending verification)
   * Owner and Manager only.
   */
  @Post('documents')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'manager')
  async uploadDocument(
    @CurrentUser() user: { id: string },
    @CurrentTenant() tenant: TenantContext,
    @Body()
    body: {
      docType: 'trade_license' | 'trn_certificate' | 'id_card' | 'other';
      fileName: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
    },
  ) {
    return this.tenancyService.uploadGymDocument(tenant.gymId, body, user.id);
  }

  /**
   * Route 3d: List verification documents
   */
  @Get('documents')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'manager')
  async getDocuments(@CurrentTenant() tenant: TenantContext) {
    return this.tenancyService.getGymDocuments(tenant.gymId);
  }

  /**
   * Route 4: List all staff for current gym
   * Requires AuthGuard and TenantGuard
   */
  @Get('staff')
  @UseGuards(AuthGuard, TenantGuard)
  async getStaff(@CurrentTenant() tenant: TenantContext) {
    return this.tenancyService.getGymStaff(tenant.gymId);
  }

  /**
   * Route 5: Assign or update staff role (Owner only)
   * Requires AuthGuard, TenantGuard, and RolesGuard with @Roles('owner')
   */
  @Post('staff')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  async assignStaff(
    @CurrentUser() user: { id: string },
    @CurrentTenant() tenant: TenantContext,
    @Body() body: unknown,
  ) {
    return this.tenancyService.assignStaff(tenant.gymId, body, user.id);
  }

  /**
   * Route 6: Get gym provider payment accounts
   * Available to Owner and Manager. Secrets are never returned.
   */
  @Get('payment-config')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'manager')
  async getPaymentConfig(@CurrentTenant() tenant: TenantContext) {
    return this.tenancyService.getPaymentConfig(tenant.gymId);
  }

  @Get('payment-accounts')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'manager')
  async getPaymentAccounts(@CurrentTenant() tenant: TenantContext) {
    return this.tenancyService.getPaymentAccounts(tenant.gymId);
  }

  /**
   * Route 6b: Get single payment account (A2 Owner-only spec)
   */
  @Get('payment-account')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  async getPaymentAccount(
    @CurrentTenant() tenant: TenantContext,
    @Query('provider') provider?: string,
  ) {
    return this.tenancyService.getPaymentAccount(tenant.gymId, provider);
  }

  /**
   * Route 6c: Set single payment account (A2 Owner-only spec)
   */
  @Put('payment-account')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  async setPaymentAccount(
    @CurrentUser() user: { id: string },
    @CurrentTenant() tenant: TenantContext,
    @Body() body: unknown,
  ) {
    return this.tenancyService.setPaymentAccount(tenant.gymId, body, user.id);
  }

  /**
   * Route 7: Configure gym provider accounts (Tap merchant ID, Razorpay Route linked account, Stripe)
   * Owner only. Platform master keys reside in secrets manager.
   * If interim secrets are provided, they are encrypted with AES-256-GCM, never returned, and logged without secrets.
   */
  @Post('payment-config')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  async updatePaymentConfig(
    @CurrentUser() user: { id: string },
    @CurrentTenant() tenant: TenantContext,
    @Body() body: unknown,
  ) {
    return this.tenancyService.updatePaymentConfig(tenant.gymId, body, user.id);
  }

  @Post('payment-accounts')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  async updatePaymentAccounts(
    @CurrentUser() user: { id: string },
    @CurrentTenant() tenant: TenantContext,
    @Body() body: unknown,
  ) {
    return this.tenancyService.updatePaymentConfig(tenant.gymId, body, user.id);
  }

  /**
   * Route 8: View tenant-scoped tamper-evident audit logs
   * Owner and Manager only.
   */
  @Get('audit-logs')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'manager')
  async getAuditLogs(@CurrentTenant() tenant: TenantContext) {
    return this.tenancyService.getAuditLogs(tenant.gymId);
  }

  /**
   * Route 9: Verify cryptographic SHA-256 hash chain integrity
   * Owner only.
   */
  @Post('audit-logs/verify')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  async verifyAuditChain() {
    return this.tenancyService.verifyAuditChain();
  }
}
