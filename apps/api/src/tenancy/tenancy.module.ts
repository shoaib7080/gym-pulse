import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { EmailModule } from '../common/email/email.module';
import { TenancyController } from './tenancy.controller';
import { TenancyService } from './tenancy.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlatformSecretsService } from '../common/secrets/platform-secrets.service';
import { ActiveGymGuard } from '../common/guards/active-gym.guard';

@Module({
  imports: [DbModule, EmailModule],
  controllers: [TenancyController],
  providers: [TenancyService, TenantGuard, AuthGuard, RolesGuard, PlatformSecretsService, ActiveGymGuard],
  exports: [TenancyService, TenantGuard, AuthGuard, RolesGuard, PlatformSecretsService, ActiveGymGuard],
})
export class TenancyModule {}
