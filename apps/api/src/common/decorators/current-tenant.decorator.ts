import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface TenantContext {
  gymId: string;
  role: 'owner' | 'manager' | 'front_desk';
  branchScope: 'all' | 'selected';
}

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    return {
      gymId: request.gymId,
      role: request.staffAssignment?.role,
      branchScope: request.staffAssignment?.branchScope,
    };
  },
);
