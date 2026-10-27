import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/db.module';
import { gyms } from '../../db/schema';

@Injectable()
export class ActiveGymGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const gymId =
      req.gymId ||
      req.headers['x-gym-id'] ||
      req.headers['X-Gym-Id'];

    if (!gymId || typeof gymId !== 'string') {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'The x-gym-id header is required for this operation',
      });
    }

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId.trim()),
    });

    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    if (gym.status !== 'active') {
      throw new ForbiddenException({
        code: 'GYM_NOT_ACTIVE',
        message: `Gym verification required: current status is '${gym.status}'. Adding branches, registering members, creating plans, selling memberships, and processing payments require an active, verified gym.`,
      });
    }

    req.gym = gym;
    return true;
  }
}
