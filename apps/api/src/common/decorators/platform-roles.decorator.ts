import { SetMetadata } from '@nestjs/common';

export type PlatformRole = 'superadmin' | 'support' | 'auditor';

export const PLATFORM_ROLES_KEY = 'platform_roles';
export const PlatformRoles = (...roles: PlatformRole[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);
