import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

/**
 * Sliding window in-memory rate limiter for early lift operations.
 * Enforces a strict limit of max 10 requests per 60 seconds per user.
 */
@Injectable()
export class LiftRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, number[]>();
  private readonly maxRequests = 10;
  private readonly windowMs = 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();

    const timestamps = this.attempts.get(userId) || [];
    // Keep only timestamps within window
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxRequests) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many freeze lift attempts. Please wait a minute before trying again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.attempts.set(userId, recent);
    return true;
  }
}
