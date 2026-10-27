import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PLATFORM_ROLES_KEY,
  type PlatformRole,
} from '../decorators/platform-roles.decorator';

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PlatformRole[]>(
      PLATFORM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const adminRole: PlatformRole | undefined = request.platformAdmin?.role;

    if (!adminRole || !requiredRoles.includes(adminRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Requires platform role in [${requiredRoles.join(', ')}]. Current role: '${adminRole ?? 'none'}'`,
      });
    }

    return true;
  }
}
