import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../auth/auth';
import { DB, type Database } from '../../db/db.module';
import { users } from '../../db/schema';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const headers = fromNodeHeaders(req.headers);
    const authHeader = req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token && token !== 'undefined') {
        const existingCookie = req.headers['cookie'] || '';
        if (!existingCookie.includes('better-auth.session_token=')) {
          headers.set(
            'cookie',
            existingCookie
              ? `${existingCookie}; better-auth.session_token=${token}`
              : `better-auth.session_token=${token}`,
          );
        }
      }
    }

    const session = await auth.api.getSession({
      headers,
    });

    if (!session) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Valid authentication session required',
      });
    }

    req.authUser = session.user;
    req.session = session.session;

    // Resolve or provision matching domain user with UUID id
    let domainUser = await this.db.query.users.findFirst({
      where: eq(users.authUserId, session.user.id),
    });

    if (!domainUser) {
      try {
        const [created] = await this.db
          .insert(users)
          .values({
            authUserId: session.user.id,
            fullName: session.user.name || 'User',
            email: session.user.email,
            nameSearch: (session.user.name || 'User').toLowerCase(),
            status: 'active',
          })
          .returning();
        domainUser = created;
      } catch {
        // Query again in case of concurrent insert
        domainUser = await this.db.query.users.findFirst({
          where: eq(users.authUserId, session.user.id),
        });
        if (!domainUser) {
          throw new UnauthorizedException('Failed to provision domain user');
        }
      }
    }

    req.user = {
      ...domainUser,
      authUserId: session.user.id,
      name: session.user.name,
    };

    return true;
  }
}
