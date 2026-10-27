import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/db.module';
import { staffAssignments } from '../../db/schema';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user?.id) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required before tenant evaluation',
      });
    }

    const rawGymId =
      req.headers['x-gym-id'] ?? req.headers['X-Gym-Id'];

    if (!rawGymId || typeof rawGymId !== 'string') {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'The x-gym-id header is required for this operation',
      });
    }

    const gymId = rawGymId.trim();

    if (!UUID_REGEX.test(gymId)) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'The x-gym-id header must be a valid UUID',
      });
    }

    const assignment = await this.db.query.staffAssignments.findFirst({
      where: and(
        eq(staffAssignments.gymId, gymId),
        eq(staffAssignments.userId, user.id),
        eq(staffAssignments.isActive, true),
      ),
    });

    if (!assignment) {
      throw new ForbiddenException({
        code: 'TENANT_MISMATCH',
        message: 'You do not have active staff access to this gym',
      });
    }

    req.gymId = gymId;
    req.staffAssignment = assignment;
    return true;
  }
}
