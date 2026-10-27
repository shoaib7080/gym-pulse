import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { TenancyController } from './tenancy.controller';
import { TenancyService } from './tenancy.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlatformSecretsService } from '../common/secrets/platform-secrets.service';

@Module({
  imports: [DbModule],
  controllers: [TenancyController],
  providers: [TenancyService, TenantGuard, AuthGuard, RolesGuard, PlatformSecretsService],
  exports: [TenancyService, TenantGuard, AuthGuard, RolesGuard, PlatformSecretsService],
})
export class TenancyModule {}
