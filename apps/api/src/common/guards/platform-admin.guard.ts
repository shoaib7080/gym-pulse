import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/db.module';
import { platformAdmins } from '../../db/schema';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user?.id) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required for platform operations',
      });
    }

    const admin = await this.db.query.platformAdmins.findFirst({
      where: and(
        eq(platformAdmins.userId, user.id),
        eq(platformAdmins.isActive, true),
      ),
    });

    if (!admin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Platform administrator access required. This incident will be reported.',
      });
    }

    req.platformAdmin = admin;
    return true;
  }
}
