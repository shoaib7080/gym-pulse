import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRole } from '@gympulse/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole: StaffRole | undefined = request.staffAssignment?.role;

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Requires one of the following roles: [${requiredRoles.join(', ')}]. Current role: '${userRole ?? 'none'}'`,
      });
    }

    return true;
  }
}
