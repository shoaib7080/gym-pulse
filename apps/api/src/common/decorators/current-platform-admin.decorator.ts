import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PlatformAdminContext {
  id: string;
  userId: string;
  role: 'superadmin' | 'support' | 'auditor';
  isActive: boolean;
}

export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAdminContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.platformAdmin;
  },
);
