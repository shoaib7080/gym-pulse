import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
  branches,
  checkIns,
  gyms,
  members,
  memberships,
  plans,
  users,
} from '../db/schema';
import { AuditService } from '../common/audit/audit.service';
import { FreezesService } from '../freezes/freezes.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';
import { getGymLocalDate } from '../common/utils/dates';
import { addDays } from '@gympulse/shared';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type {
  CheckInResponsePayload,
  ICheckInService,
  MemberCheckInAttemptEvent,
} from './check-in.types';

function toUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_REGEX.test(val) ? val : null;
}

@Injectable()
export class CheckInService implements ICheckInService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly freezesService: FreezesService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Process incoming check-in attempt via abstract domain interface
   */
  async processCheckIn(
    event: MemberCheckInAttemptEvent,
  ): Promise<CheckInResponsePayload> {
    // Enforce platform SaaS subscription status (e.g. suspended gyms have check-in disabled)
    await this.subscriptionsService.checkCheckInAllowed(event.gymId);

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, event.gymId),
    });

    if (!gym) {
      throw new NotFoundException({
        code: 'GYM_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    // 1. Dynamic Feature Gating (Spec Requirement 2c)
    // Inspect gym settings / feature flags for temp_self_checkin_enabled
    const gymSettings = (gym.settings || {}) as Record<string, unknown>;
    const tempSelfCheckInEnabled =
      gymSettings.temp_self_checkin_enabled !== false; // enabled by default unless turned off

    if (event.method === 'self_tap_temporary' && !tempSelfCheckInEnabled) {
      throw new ForbiddenException({
        code: 'SELF_CHECKIN_DISABLED',
        message: 'Temporary self-tap check-in is not enabled for this gym',
      });
    }

    const today = getGymLocalDate(gym.timezone || 'Asia/Dubai');

    // 2. Resolve Member and Membership
    let membership: any = null;

    if (event.membershipId) {
      membership = await this.db.query.memberships.findFirst({
        where: scopeEntityToGym(memberships, event.gymId, event.membershipId),
      });
      if (!membership) {
        throw new NotFoundException({
          code: 'MEMBERSHIP_NOT_FOUND',
          message: 'Membership not found in this gym',
        });
      }
    } else if (event.memberId) {
      const memberMemberships = await this.db.query.memberships.findMany({
        where: scopeToGym(
          memberships,
          event.gymId,
          eq(memberships.memberId, event.memberId),
        ),
        orderBy: [desc(memberships.endDate)],
      });

      if (!memberMemberships || memberMemberships.length === 0) {
        throw new NotFoundException({
          code: 'MEMBERSHIP_NOT_FOUND',
          message: 'Member has no memberships in this gym',
        });
      }

      membership =
        memberMemberships.find(
          (m) => m.status === 'active' || m.status === 'frozen',
        ) || memberMemberships[0];
    } else {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Either memberId or membershipId must be provided',
      });
    }

    const resolvedMemberId = membership.memberId;

    // 3. Sliding Anti-Spam Cooldown Enforcement (Spec Requirement 2b)
    // Enforce 6-to-12 hour cooldown (default 8 hours) for self-tap
    if (event.method === 'self_tap_temporary') {
      const cooldownHours =
        typeof gymSettings.selfCheckInCooldownHours === 'number'
          ? Math.max(6, Math.min(12, gymSettings.selfCheckInCooldownHours))
          : 8;
      const cooldownWindowMs = cooldownHours * 60 * 60 * 1000;
      const cooldownThreshold = new Date(Date.now() - cooldownWindowMs);

      const recentCheckIn = await this.db.query.checkIns.findFirst({
        where: and(
          eq(checkIns.gymId, event.gymId),
          eq(checkIns.memberId, resolvedMemberId),
          eq(checkIns.result, 'allowed'),
          gte(checkIns.createdAt, cooldownThreshold),
        ),
        orderBy: [desc(checkIns.createdAt)],
      });

      if (recentCheckIn) {
        const timeElapsedMs =
          Date.now() - new Date(recentCheckIn.createdAt).getTime();
        const remainingMinutes = Math.max(
          1,
          Math.ceil((cooldownWindowMs - timeElapsedMs) / (60 * 1000)),
        );

        throw new HttpException(
          {
            code: 'SELF_CHECKIN_COOLDOWN_ACTIVE',
            message: `Attendance already recorded. Cooldown active for another ${remainingMinutes} minutes.`,
            cooldownRemainingMinutes: remainingMinutes,
            lastCheckInAt: recentCheckIn.createdAt,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 4. Run Lazy Freeze Settlement (ensuring state is up to the minute)
    await this.freezesService.settleDueFreezesForMembership(
      event.gymId,
      membership.id,
      today,
    );

    // Reload fresh membership
    const freshMembership = await this.db.query.memberships.findFirst({
      where: scopeEntityToGym(memberships, event.gymId, membership.id),
    });
    if (!freshMembership) {
      throw new NotFoundException({
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'Membership not found after freeze settlement',
      });
    }
    membership = freshMembership;

    // 5. Subscription Status Verification (Spec Requirement 2a)
    // Strictly active required; frozen or expired must be rejected with RFC 7807 problem details
    const isSelfTap = event.method === 'self_tap_temporary';
    if (membership.status === 'frozen') {
      throw new BadRequestException({
        code: isSelfTap ? 'FREEZE_ACTIVE' : 'MEMBERSHIP_FROZEN',
        reasons: ['FREEZE_ACTIVE', 'MEMBERSHIP_FROZEN'],
        message: 'Membership is currently frozen',
      });
    }

    if (membership.status !== 'active') {
      throw new BadRequestException({
        code: 'MEMBERSHIP_NOT_ELIGIBLE',
        reasons: ['MEMBERSHIP_NOT_ELIGIBLE', `STATUS_${membership.status.toUpperCase()}`],
        message: `Member subscription is not active (current status: ${membership.status})`,
      });
    }

    // 6. Term Date Validity & Grace Period Check
    const plan = await this.db.query.plans.findFirst({
      where: scopeEntityToGym(plans, event.gymId, membership.planId),
    });

    const graceDays = plan?.graceDays ?? 0;
    const finalAllowedDate =
      graceDays > 0 ? addDays(membership.endDate, graceDays) : membership.endDate;

    if (today < membership.startDate) {
      throw new BadRequestException({
        code: 'MEMBERSHIP_NOT_ELIGIBLE',
        reasons: ['MEMBERSHIP_NOT_ELIGIBLE', 'MEMBERSHIP_NOT_STARTED'],
        message: `Membership term begins on ${membership.startDate}`,
      });
    }

    if (today > finalAllowedDate) {
      throw new BadRequestException({
        code: 'MEMBERSHIP_NOT_ELIGIBLE',
        reasons: ['MEMBERSHIP_NOT_ELIGIBLE', 'MEMBERSHIP_EXPIRED'],
        message: `Membership expired on ${membership.endDate}`,
      });
    }

    // 7. Resolve Target Branch & Single Branch Access Rule
    let targetBranchId = event.branchId || membership.branchId;
    if (!targetBranchId) {
      const defaultBranch = await this.db.query.branches.findFirst({
        where: eq(branches.gymId, event.gymId),
      });
      targetBranchId = defaultBranch?.id;
    }

    if (plan?.branchAccess === 'home_only' && membership.branchId && targetBranchId) {
      if (targetBranchId !== membership.branchId) {
        throw new BadRequestException({
          code: 'MEMBERSHIP_NOT_ELIGIBLE',
          reasons: ['MEMBERSHIP_NOT_ELIGIBLE', 'CROSS_BRANCH_ACCESS_DENIED'],
          message: 'Plan is restricted to member home branch',
        });
      }
    }

    // 8. Persistence & Audit (Spec Requirement 3)
    // Insert into check_ins with method = 'self_tap_temporary', result = 'allowed', verified_by = NULL
    const [insertedCheckIn] = await this.db
      .insert(checkIns)
      .values({
        gymId: event.gymId,
        branchId: targetBranchId!,
        memberId: resolvedMemberId,
        membershipId: membership.id,
        result: 'allowed',
        method: event.method,
        verifiedBy: isSelfTap ? null : toUuidOrNull(event.actorUserId),
        createdAt: new Date(),
      })
      .returning();

    await this.auditService.log({
      gymId: event.gymId,
      actorUserId: isSelfTap ? null : (event.actorUserId ?? null),
      action: isSelfTap ? 'attendance.self_tap' : 'attendance.allowed',
      entityType: 'check_in',
      entityId: insertedCheckIn.id,
      payload: {
        method: event.method,
        memberId: resolvedMemberId,
        membershipId: membership.id,
        branchId: targetBranchId,
        today,
        selfTapStopgap: isSelfTap,
      },
    });

    // Resolve Member User profile for response
    const member = await this.db.query.members.findFirst({
      where: scopeEntityToGym(members, event.gymId, resolvedMemberId),
    });
    const memberUser = member?.userId
      ? await this.db.query.users.findFirst({
          where: eq(users.id, member.userId),
        })
      : null;

    // Compute simple monthly streak (distinct check-in days this month)
    const monthPrefix = today.slice(0, 7); // 'YYYY-MM'
    const monthCheckIns = await this.db.query.checkIns.findMany({
      where: and(
        eq(checkIns.gymId, event.gymId),
        eq(checkIns.memberId, resolvedMemberId),
        eq(checkIns.result, 'allowed'),
        sql`${checkIns.createdAt} >= ${new Date(monthPrefix + '-01T00:00:00Z')}`,
      ),
    });

    const distinctDays = new Set(
      monthCheckIns.map((c) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: gym.timezone || 'Asia/Dubai',
        }).format(new Date(c.createdAt)),
      ),
    );

    return {
      success: true,
      checkInId: insertedCheckIn.id,
      result: 'allowed',
      method: event.method,
      recordedAt: insertedCheckIn.createdAt.toISOString(),
      checkIn: insertedCheckIn,
      member: {
        id: resolvedMemberId,
        fullName: memberUser?.fullName || 'Gym Member',
        memberNumber: member?.memberNumber || 'MEM-0000',
      },
      membership: {
        id: membership.id,
        planTitle: plan?.title || 'Gym Membership',
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
      },
      streak: {
        currentStreak: distinctDays.size,
        visitDate: today,
        message: 'Visit Logged for Today',
      },
    };
  }

  /**
   * History of check-ins for reports and staff auditing
   */
  async getCheckInHistory(
    gymId: string,
    filters: {
      memberId?: string;
      membershipId?: string;
      branchId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const conditions = [eq(checkIns.gymId, gymId)];
    if (filters.memberId) {
      conditions.push(eq(checkIns.memberId, filters.memberId));
    }
    if (filters.membershipId) {
      conditions.push(eq(checkIns.membershipId, filters.membershipId));
    }
    if (filters.branchId) {
      conditions.push(eq(checkIns.branchId, filters.branchId));
    }

    const items = await this.db.query.checkIns.findMany({
      where: and(...conditions),
      orderBy: [desc(checkIns.createdAt)],
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
    });

    return {
      items,
      total: items.length,
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
    };
  }
}
