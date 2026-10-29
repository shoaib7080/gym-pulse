import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
  freezePolicies,
  freezeProofs,
  gyms,
  membershipAdjustments,
  membershipFreezes,
  memberships,
  plans,
  users,
} from '../db/schema';
import {
  addDays,
  calculateFreezeMath,
  calculateInclusiveDays,
  formatDateOnly,
  type CreateFreezeInput,
  type EarlyLiftFreezeInput,
  type FreezePreviewInput,
} from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';
import { getGymLocalDate } from '../common/utils/dates';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export { getGymLocalDate };

export function getTodayInGymTimezone(
  timezone: string = 'Asia/Dubai',
  referenceDate: Date = new Date(),
): string {
  return getGymLocalDate(timezone, referenceDate);
}

export function toUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
    ? val
    : null;
}

export interface EligibilityResult {
  isEligible: boolean;
  membershipId: string;
  membershipStatus: string;
  policy: {
    id: string;
    isEnabled: boolean;
    maxOccurrences: number;
    minDays: number;
    maxTotalDays: number;
    noticeDays: number;
    proofMode: 'none' | 'optional' | 'required';
    requireReview: boolean;
    cycleBasis: 'membership_term' | 'anniversary_year';
    allowRemainingBalance: boolean;
    feeMinor: number;
    currency: string;
  } | null;
  usedDays: number;
  remainingDays: number;
  usedOccurrences: number;
  remainingOccurrences: number;
  reasons: string[];
}

@Injectable()
export class FreezesService {
  private readonly logger = new Logger(FreezesService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Resolve effective freeze policy for a membership plan (plan override > gym default)
   */
  async resolveActivePolicy(gymId: string, planId?: string | null) {
    let policy = null;
    if (planId) {
      policy = await this.db.query.freezePolicies.findFirst({
        where: and(
          eq(freezePolicies.gymId, gymId),
          eq(freezePolicies.planId, planId),
        ),
      });
    }

    if (!policy) {
      policy = await this.db.query.freezePolicies.findFirst({
        where: and(
          eq(freezePolicies.gymId, gymId),
          isNull(freezePolicies.planId),
        ),
      });
    }

    return policy;
  }

  /**
   * Idempotent freeze settlement for a single membership (Spec Section 6.2 & 7.4)
   * Executed lazily at check-in scan time, before evaluating eligibility, and on view.
   */
  async settleDueFreezesForMembership(
    gymId: string,
    membershipId: string,
    asOfDate?: string,
  ) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const today = asOfDate || getGymLocalDate(gym?.timezone || 'Asia/Dubai');

    const membership = await this.db.query.memberships.findFirst({
      where: scopeEntityToGym(memberships, gymId, membershipId),
    });
    if (!membership) return;

    // 1. Notice-period cancellation whose effective date has arrived
    if (
      membership.status !== 'cancelled' &&
      membership.cancelEffectiveDate &&
      membership.cancelEffectiveDate <= today
    ) {
      await this.db.transaction(async (tx) => {
        await tx
          .update(memberships)
          .set({
            status: 'cancelled',
            statusBeforeFreeze: null,
            version: membership.version + 1,
            updatedAt: new Date(),
          })
          .where(scopeEntityToGym(memberships, gymId, membershipId));

        await tx
          .update(membershipFreezes)
          .set({
            status: 'cancelled',
            rejectionReason: 'Cancelled: membership cancellation effective date reached',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(membershipFreezes.gymId, gymId),
              eq(membershipFreezes.membershipId, membershipId),
              inArray(membershipFreezes.status, ['active', 'scheduled', 'pending_review']),
            ),
          );

        await this.auditService.log({
          gymId,
          actorUserId: null,
          action: 'membership.cancel_effective',
          entityType: 'membership',
          entityId: membershipId,
          payload: {
            cancelEffectiveDate: membership.cancelEffectiveDate,
            settledOn: today,
          },
        });
      });
      return;
    }

    // 2. Expire pending_review requests whose start date has passed
    const pendingExpiredFreezes = await this.db.query.membershipFreezes.findMany({
      where: and(
        eq(membershipFreezes.gymId, gymId),
        eq(membershipFreezes.membershipId, membershipId),
        eq(membershipFreezes.status, 'pending_review'),
        sql`${membershipFreezes.startDate} < ${today}`,
      ),
    });

    for (const f of pendingExpiredFreezes) {
      await this.db
        .update(membershipFreezes)
        .set({
          status: 'rejected',
          rejectionReason: 'Expired: start date passed without approval',
          updatedAt: new Date(),
        })
        .where(scopeEntityToGym(membershipFreezes, gymId, f.id));

      await this.auditService.log({
        gymId,
        actorUserId: null,
        action: 'freeze.expire',
        entityType: 'membership_freeze',
        entityId: f.id,
        payload: { startDate: f.startDate, today },
      });
    }

    // 3. Complete ended active freezes (adding full N days as a freeze ledger row and restoring membership)
    const endedActiveFreezes = await this.db.query.membershipFreezes.findMany({
      where: and(
        eq(membershipFreezes.gymId, gymId),
        eq(membershipFreezes.membershipId, membershipId),
        eq(membershipFreezes.status, 'active'),
        sql`${membershipFreezes.endDate} < ${today}`,
      ),
    });

    for (const f of endedActiveFreezes) {
      const N = calculateInclusiveDays(f.startDate, f.endDate);
      const currentMembership = await this.db.query.memberships.findFirst({
        where: scopeEntityToGym(memberships, gymId, membershipId),
      });
      if (!currentMembership) continue;

      const previousEndDate = currentMembership.endDate;
      const newEndDate = addDays(previousEndDate, N);
      const restoredStatus = (currentMembership.statusBeforeFreeze as any) || 'active';

      await this.db.transaction(async (tx) => {
        // Complete freeze
        await tx
          .update(membershipFreezes)
          .set({
            status: 'completed',
            daysCharged: N,
            updatedAt: new Date(),
          })
          .where(scopeEntityToGym(membershipFreezes, gymId, f.id));

        // Restore membership & extend end date
        await tx
          .update(memberships)
          .set({
            endDate: newEndDate,
            status: restoredStatus,
            statusBeforeFreeze: null,
            version: currentMembership.version + 1,
            updatedAt: new Date(),
          })
          .where(scopeEntityToGym(memberships, gymId, membershipId));

        // Add freeze ledger row
        await tx.insert(membershipAdjustments).values({
          gymId,
          membershipId,
          kind: 'freeze',
          previousEndDate,
          newEndDate,
          freezeId: f.id,
          reason: `Freeze completed full term (${N} days added)`,
          createdBy: null,
        });

        await this.auditService.log({
          gymId,
          actorUserId: null,
          action: 'freeze.complete',
          entityType: 'membership_freeze',
          entityId: f.id,
          payload: {
            daysCharged: N,
            previousEndDate,
            newEndDate,
            today,
          },
        });
      });
    }

    // 4. Activate due scheduled freezes
    const dueScheduledFreezes = await this.db.query.membershipFreezes.findMany({
      where: and(
        eq(membershipFreezes.gymId, gymId),
        eq(membershipFreezes.membershipId, membershipId),
        eq(membershipFreezes.status, 'scheduled'),
        sql`${membershipFreezes.startDate} <= ${today}`,
      ),
    });

    for (const f of dueScheduledFreezes) {
      const currentMembership = await this.db.query.memberships.findFirst({
        where: scopeEntityToGym(memberships, gymId, membershipId),
      });
      if (!currentMembership || currentMembership.status === 'cancelled') continue;

      await this.db.transaction(async (tx) => {
        await tx
          .update(membershipFreezes)
          .set({
            status: 'active',
            updatedAt: new Date(),
          })
          .where(scopeEntityToGym(membershipFreezes, gymId, f.id));

        if (currentMembership.status !== 'frozen') {
          await tx
            .update(memberships)
            .set({
              status: 'frozen',
              statusBeforeFreeze: currentMembership.status,
              version: currentMembership.version + 1,
              updatedAt: new Date(),
            })
            .where(scopeEntityToGym(memberships, gymId, membershipId));
        }

        await this.auditService.log({
          gymId,
          actorUserId: null,
          action: 'freeze.activate',
          entityType: 'membership_freeze',
          entityId: f.id,
          payload: {
            startDate: f.startDate,
            today,
          },
        });
      });
    }
  }

  /**
   * Daily scheduled / on-demand settlement job for an entire gym
   */
  async settleDueFreezesForGym(gymId: string, asOfDate?: string) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const today = asOfDate || getGymLocalDate(gym?.timezone || 'Asia/Dubai');

    const relevantFreezes = await this.db.query.membershipFreezes.findMany({
      where: and(
        eq(membershipFreezes.gymId, gymId),
        inArray(membershipFreezes.status, ['scheduled', 'active', 'pending_review']),
      ),
    });

    const membershipIds = new Set(relevantFreezes.map((f) => f.membershipId));

    const noticeMemberships = await this.db.query.memberships.findMany({
      where: and(
        eq(memberships.gymId, gymId),
        sql`${memberships.status} != 'cancelled'`,
        sql`${memberships.cancelEffectiveDate} IS NOT NULL`,
        sql`${memberships.cancelEffectiveDate} <= ${today}`,
      ),
    });

    for (const m of noticeMemberships) {
      membershipIds.add(m.id);
    }

    let settledCount = 0;
    for (const mId of membershipIds) {
      await this.settleDueFreezesForMembership(gymId, mId, today);
      settledCount++;
    }

    return {
      gymId,
      settledMembershipsCount: settledCount,
      asOfDate: today,
    };
  }

  /**
   * 10-Step Eligibility Check (Spec Section 7.2)
   */
  async checkFreezeEligibility(
    gymId: string,
    membershipId: string,
    draftDates?: {
      startDate: string;
      endDate: string;
      proofStorageKey?: string;
      waiveNotice?: boolean;
    },
  ): Promise<EligibilityResult> {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const gymTimezone = gym?.timezone || 'Asia/Dubai';
    const today = getGymLocalDate(gymTimezone);

    // 1. Settle any due freezes lazily upfront
    await this.settleDueFreezesForMembership(gymId, membershipId, today);

    const reasons: string[] = [];

    // 2. Fetch fresh membership
    const membership = await this.db.query.memberships.findFirst({
      where: scopeEntityToGym(memberships, gymId, membershipId),
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Membership not found',
      });
    }

    // 3. Resolve freeze policy (Rule 1)
    const rawPolicy = await this.resolveActivePolicy(gymId, membership.planId);
    if (!rawPolicy || !rawPolicy.isEnabled) {
      reasons.push('FREEZE_NOT_ENABLED');
    }

    // Rule 2: Membership status active
    if (membership.status !== 'active') {
      reasons.push('MEMBERSHIP_NOT_ELIGIBLE');
    }

    // Pending cancellation notice blocks freezes
    if (membership.cancelEffectiveDate) {
      reasons.push('MEMBERSHIP_NOT_ELIGIBLE');
    }

    // Rule 3: No unpaid balance
    if (membership.status === 'pending_payment') {
      reasons.push('BALANCE_OUTSTANDING');
    }

    // 4. Calculate dynamic quota usage from history
    const existingFreezes = await this.db.query.membershipFreezes.findMany({
      where: and(
        eq(membershipFreezes.gymId, gymId),
        eq(membershipFreezes.membershipId, membershipId),
      ),
    });

    // Check cycle_basis setting: anniversary_year vs membership_term
    let cycleStartDate = membership.startDate;
    let cycleEndDate = membership.endDate;
    if (rawPolicy?.cycleBasis === 'anniversary_year') {
      const [startY, startM, startD] = membership.startDate.split('-').map(Number);
      const [todayY, todayM, todayD] = today.split('-').map(Number);
      let anniversaryYear = todayY - startY;
      if (todayM < startM || (todayM === startM && todayD < startD)) {
        anniversaryYear -= 1;
      }
      anniversaryYear = Math.max(0, anniversaryYear);
      const curCycleStart = new Date(Date.UTC(startY + anniversaryYear, startM - 1, startD));
      const nextCycleStart = new Date(Date.UTC(startY + anniversaryYear + 1, startM - 1, startD));
      nextCycleStart.setUTCDate(nextCycleStart.getUTCDate() - 1);
      cycleStartDate = formatDateOnly(curCycleStart);
      cycleEndDate = formatDateOnly(nextCycleStart);
    }

    const activeOrHistoricalFreezes = existingFreezes.filter(
      (f) =>
        f.status !== 'cancelled' &&
        f.status !== 'rejected' &&
        (rawPolicy?.cycleBasis !== 'anniversary_year' ||
          (f.startDate >= cycleStartDate && f.startDate <= cycleEndDate)),
    );

    let usedDays = 0;
    for (const f of activeOrHistoricalFreezes) {
      if (f.status === 'completed' || f.status === 'early_lifted') {
        usedDays += f.daysCharged ?? calculateInclusiveDays(f.startDate, f.endDate);
      } else {
        usedDays += calculateInclusiveDays(f.startDate, f.endDate);
      }
    }

    const usedOccurrences = activeOrHistoricalFreezes.length;
    const maxTotalDays = rawPolicy?.maxTotalDays ?? 0;
    const maxOccurrences = rawPolicy?.maxOccurrences ?? 0;
    const remainingDays = Math.max(0, maxTotalDays - usedDays);
    const remainingOccurrences = Math.max(0, maxOccurrences - usedOccurrences);

    // Rule 7: Occurrence limit not exceeded
    if (remainingOccurrences <= 0) {
      reasons.push('FREEZE_QUOTA_EXCEEDED');
    }

    // 5. Date-dependent rules (Rules 4, 5, 6, 8, 9, 10)
    if (draftDates) {
      const { startDate, endDate, proofStorageKey, waiveNotice } = draftDates;
      const requestedDays = calculateInclusiveDays(startDate, endDate);

      // Rule 9: No overlapping or directly adjacent freeze (checked first)
      for (const f of activeOrHistoricalFreezes) {
        const exStart = f.startDate;
        const exEnd = f.liftedOn || f.endDate;
        if (startDate <= addDays(exEnd, 1) && endDate >= addDays(exStart, -1)) {
          reasons.push('FREEZE_OVERLAP');
          break;
        }
      }

      // No back-dating: past start dates strictly rejected and cannot be waived
      if (startDate < today) {
        reasons.push('FREEZE_START_IN_PAST');
      }

      // Rule 8: Current membership term check & cancellation notice bounds
      const effectiveBound = membership.cancelEffectiveDate || membership.endDate;
      if (startDate < membership.startDate || endDate > effectiveBound) {
        reasons.push('FREEZE_OUTSIDE_MEMBERSHIP');
      }

      // Rule 4: Notice period check (only waivable by owner or manager)
      const minAllowedNoticeDate = addDays(today, rawPolicy?.noticeDays ?? 0);
      if (!waiveNotice && startDate < minAllowedNoticeDate) {
        reasons.push('FREEZE_NOTICE_TOO_SHORT');
      }

      // Rule 5: Minimum duration check & remaining-balance exception
      const minDays = rawPolicy?.minDays ?? 1;
      if (rawPolicy?.allowRemainingBalance && remainingDays < minDays) {
        // Spec: Remaining-balance exception applies ONLY when the request uses EXACTLY the remaining balance
        if (requestedDays !== remainingDays) {
          reasons.push('FREEZE_TOO_SHORT');
        }
      } else {
        if (requestedDays < minDays) {
          reasons.push('FREEZE_TOO_SHORT');
        }
      }

      // Rule 6: Remaining quota check
      if (requestedDays > remainingDays) {
        reasons.push('FREEZE_QUOTA_EXCEEDED');
      }

      // Rule 10: Proof required check
      if (rawPolicy?.proofMode === 'required' && !proofStorageKey) {
        reasons.push('PROOF_REQUIRED');
      }
    }

    return {
      isEligible: reasons.length === 0,
      membershipId,
      membershipStatus: membership.status,
      policy: rawPolicy
        ? {
            id: rawPolicy.id,
            isEnabled: rawPolicy.isEnabled,
            maxOccurrences: rawPolicy.maxOccurrences,
            minDays: rawPolicy.minDays,
            maxTotalDays: rawPolicy.maxTotalDays,
            noticeDays: rawPolicy.noticeDays,
            proofMode: rawPolicy.proofMode,
            requireReview: rawPolicy.requireReview,
            cycleBasis: rawPolicy.cycleBasis,
            allowRemainingBalance: rawPolicy.allowRemainingBalance,
            feeMinor: Number(rawPolicy.feeMinor),
            currency: rawPolicy.currency,
          }
        : null,
      usedDays,
      remainingDays,
      usedOccurrences,
      remainingOccurrences,
      reasons: Array.from(new Set(reasons)),
    };
  }

  /**
   * Preview a proposed freeze (Inclusive math N = E - S + 1, fees, early lift charge preview)
   */
  async previewFreeze(gymId: string, membershipId: string, input: FreezePreviewInput) {
    if (input.startDate > input.endDate) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'startDate cannot be after endDate',
      });
    }

    const membership = await this.db.query.memberships.findFirst({
      where: scopeEntityToGym(memberships, gymId, membershipId),
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Membership not found',
      });
    }

    const eligibility = await this.checkFreezeEligibility(gymId, membershipId, {
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const N = calculateInclusiveDays(input.startDate, input.endDate);
    const minDays = eligibility.policy?.minDays ?? 7;
    const minDaysCharge = Math.min(N, minDays);
    const projectedEndDate = addDays(membership.endDate, N);
    const remainingDaysAfter = Math.max(0, eligibility.remainingDays - N);

    return {
      membershipId,
      startDate: input.startDate,
      endDate: input.endDate,
      requestedDays: N,
      minEarlyLiftChargeDays: minDaysCharge,
      currentEndDate: membership.endDate,
      projectedEndDate,
      remainingDaysAfter,
      feeMinor: eligibility.policy?.feeMinor ?? 0,
      currency: eligibility.policy?.currency ?? 'AED',
      isEligible: eligibility.isEligible,
      reasons: eligibility.reasons,
      policy: eligibility.policy,
    };
  }

  /**
   * Submit a freeze request (Spec Section 7.3)
   */
  async createFreeze(
    gymId: string,
    membershipId: string,
    input: CreateFreezeInput,
    actorUserId?: string,
    actorRole?: string,
    idempotencyKey?: string,
  ) {
    // Enforce platform SaaS subscription status (restricted gyms cannot add freezes)
    await this.subscriptionsService.checkFreezeAllowed(gymId);

    if (input.startDate > input.endDate) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'startDate cannot be after endDate',
      });
    }

    const isStaff =
      actorRole === 'owner' || actorRole === 'manager' || actorRole === 'front_desk';
    // Notice waiver is strictly restricted to owner or manager
    const canWaiveNotice = actorRole === 'owner' || actorRole === 'manager';

    // 1. Evaluate all 10 eligibility rules
    const eligibility = await this.checkFreezeEligibility(gymId, membershipId, {
      startDate: input.startDate,
      endDate: input.endDate,
      proofStorageKey: input.proofStorageKey,
      waiveNotice: canWaiveNotice,
    });

    if (!eligibility.isEligible) {
      const primaryReason =
        eligibility.reasons.find((r) => r === 'FREEZE_OVERLAP') ||
        eligibility.reasons.find((r) => r === 'FREEZE_START_IN_PAST') ||
        eligibility.reasons[0];
      throw new BadRequestException({
        code: primaryReason,
        message: `Freeze request rejected by eligibility rules: ${eligibility.reasons.join(', ')}`,
        reasons: eligibility.reasons,
      });
    }

    // 2. Fetch membership
    const membership = await this.db.query.memberships.findFirst({
      where: scopeEntityToGym(memberships, gymId, membershipId),
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Membership not found',
      });
    }

    // 3. Fetch gym for timezone & today
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const gymTimezone = gym?.timezone || 'Asia/Dubai';
    const today = getGymLocalDate(gymTimezone);

    // 4. Duplicate / Idempotency check
    const existing = await this.db.query.membershipFreezes.findFirst({
      where: and(
        eq(membershipFreezes.gymId, gymId),
        eq(membershipFreezes.membershipId, membershipId),
        eq(membershipFreezes.startDate, input.startDate),
        eq(membershipFreezes.endDate, input.endDate),
      ),
    });
    if (existing && existing.status !== 'cancelled' && existing.status !== 'rejected') {
      if (idempotencyKey) {
        return existing;
      }
      throw new ConflictException({
        code: 'FREEZE_OVERLAP',
        message: 'A freeze request already exists for these dates',
      });
    }

    // 5. Determine initial status
    let initialStatus: 'pending_review' | 'scheduled' | 'active' = 'scheduled';
    if (
      eligibility.policy?.requireReview ||
      (eligibility.policy?.proofMode === 'required' && !isStaff)
    ) {
      initialStatus = 'pending_review';
    } else if (input.startDate <= today) {
      initialStatus = 'active';
    }

    const source: 'member_app' | 'staff' = isStaff ? 'staff' : 'member_app';

    try {
      return await this.db.transaction(async (tx) => {
      // 6. Insert membership_freezes row (guarded by PostgreSQL exclusion constraint)
      let newFreeze;
      try {
        const [inserted] = await tx
          .insert(membershipFreezes)
          .values({
            gymId,
            membershipId,
            startDate: input.startDate,
            endDate: input.endDate,
            status: initialStatus,
            reasonCode: input.reasonCode,
            reasonNote: input.reasonNote ?? null,
            policySnapshot: eligibility.policy ?? {},
            feeMinor: eligibility.policy?.feeMinor ?? 0,
            currency: eligibility.policy?.currency ?? 'AED',
            source,
            requestedBy: toUuidOrNull(actorUserId),
          })
          .returning();
        newFreeze = inserted;
      } catch (err: any) {
        const errCode = err?.code || err?.cause?.code;
        const errMsg = `${err?.message || ''} ${err?.cause?.message || ''}`;
        const constraint = err?.constraint || err?.cause?.constraint;

        if (
          constraint === 'no_overlapping_freezes' ||
          errCode === '23P01' ||
          errMsg.toLowerCase().includes('no_overlapping_freezes') ||
          errMsg.toLowerCase().includes('exclusion')
        ) {
          throw new ConflictException({
            code: 'FREEZE_OVERLAP',
            message: 'A freeze request already exists or overlaps (or is back-to-back) with these dates',
          });
        }

        if (
          constraint === 'adjustment_once_per_freeze' ||
          errMsg.toLowerCase().includes('adjustment_once_per_freeze')
        ) {
          throw new ConflictException({
            code: 'FREEZE_ALREADY_LIFTED',
            message: 'This freeze has already been lifted or settled in the ledger',
          });
        }

        if (errCode === '23505') {
          this.logger.error(`Unique constraint violation on constraint '${constraint || 'unknown'}': ${errMsg}`);
          throw new ConflictException({
            code: 'RESOURCE_CONFLICT',
            message: 'A conflicting record already exists',
          });
        }

        throw err;
      }

      // 7. Attach proof record if provided (30-day retention post-verification)
      if (input.proofStorageKey) {
        await tx.insert(freezeProofs).values({
          gymId,
          freezeId: newFreeze.id,
          storageKey: input.proofStorageKey,
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          sha256: 'mock_sha256',
          reviewStatus: 'pending',
          deleteAfter: addDays(today, 30),
          uploadedBy: toUuidOrNull(actorUserId),
        });
      }

      // 8. If active immediately, transition membership status to frozen with version check
      if (initialStatus === 'active') {
        const [updatedMem] = await tx
          .update(memberships)
          .set({
            status: 'frozen',
            statusBeforeFreeze: membership.status,
            version: membership.version + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              scopeEntityToGym(memberships, gymId, membershipId),
              eq(memberships.version, membership.version),
            ),
          )
          .returning();

        if (!updatedMem) {
          throw new ConflictException({
            code: 'VERSION_CONFLICT',
            message: 'Membership was concurrently modified',
          });
        }
      }

      // 9. Append audit log
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'freeze.request',
        entityType: 'membership_freeze',
        entityId: newFreeze.id,
        payload: {
          membershipId,
          startDate: input.startDate,
          endDate: input.endDate,
          initialStatus,
          reasonCode: input.reasonCode,
          noticeWaived: canWaiveNotice && input.startDate < addDays(today, eligibility.policy?.noticeDays ?? 0),
          waivedBy: canWaiveNotice ? actorUserId : null,
        },
      });

      return newFreeze;
    });
  } catch (err: any) {
    if (
      err instanceof ConflictException ||
      err instanceof BadRequestException ||
      err instanceof NotFoundException
    ) {
      throw err;
    }
    if (
      err?.cause instanceof ConflictException ||
      err?.cause instanceof BadRequestException ||
      err?.cause instanceof NotFoundException
    ) {
      throw err.cause;
    }
    const errCode = err?.code || err?.cause?.code;
    const errMsg = `${err?.message || ''} ${err?.cause?.message || ''}`;
    const constraint = err?.constraint || err?.cause?.constraint;

    if (
      constraint === 'no_overlapping_freezes' ||
      errCode === '23P01' ||
      errMsg.toLowerCase().includes('no_overlapping_freezes') ||
      errMsg.toLowerCase().includes('exclusion') ||
      errMsg.toLowerCase().includes('freeze_overlap')
    ) {
      throw new ConflictException({
        code: 'FREEZE_OVERLAP',
        message: 'A freeze request already exists or overlaps (or is back-to-back) with these dates',
      });
    }

    if (
      constraint === 'adjustment_once_per_freeze' ||
      errMsg.toLowerCase().includes('adjustment_once_per_freeze')
    ) {
      throw new ConflictException({
        code: 'FREEZE_ALREADY_LIFTED',
        message: 'This freeze has already been lifted or settled in the ledger',
      });
    }

    if (errCode === '40P01' || errCode === '40001') {
      throw new ConflictException({
        code: 'FREEZE_OVERLAP',
        message: 'A freeze request already exists or overlaps (or is back-to-back) with these dates',
      });
    }

    if (errCode === '23505') {
      this.logger.error(`Unique constraint violation on constraint '${constraint || 'unknown'}': ${errMsg}`);
      throw new ConflictException({
        code: 'RESOURCE_CONFLICT',
        message: 'A conflicting record already exists',
      });
    }

    throw err;
  }
}

  /**
   * List freezes for gym with optional filters
   */
  async listFreezes(
    gymId: string,
    options: { status?: string; membershipId?: string; limit?: number; offset?: number } = {},
  ) {
    const conditions = [eq(membershipFreezes.gymId, gymId)];
    if (options.status) {
      conditions.push(eq(membershipFreezes.status, options.status as any));
    }
    if (options.membershipId) {
      conditions.push(eq(membershipFreezes.membershipId, options.membershipId));
    }

    const items = await this.db.query.membershipFreezes.findMany({
      where: and(...conditions),
      orderBy: [desc(membershipFreezes.createdAt)],
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    });

    return {
      items,
      total: items.length,
    };
  }

  /**
   * Get freeze details with proofs
   */
  async getFreezeById(gymId: string, freezeId: string) {
    const freeze = await this.db.query.membershipFreezes.findFirst({
      where: scopeEntityToGym(membershipFreezes, gymId, freezeId),
    });
    if (!freeze) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Freeze not found',
      });
    }

    const proofs = await this.db.query.freezeProofs.findMany({
      where: and(
        eq(freezeProofs.gymId, gymId),
        eq(freezeProofs.freezeId, freezeId),
      ),
    });

    const membership = await this.db.query.memberships.findFirst({
      where: scopeEntityToGym(memberships, gymId, freeze.membershipId),
    });

    return {
      ...freeze,
      membership,
      proofs,
    };
  }

  /**
   * Approve pending freeze request (Owner or Manager)
   */
  async approveFreeze(gymId: string, freezeId: string, actorUserId?: string) {
    const freeze = await this.db.query.membershipFreezes.findFirst({
      where: scopeEntityToGym(membershipFreezes, gymId, freezeId),
    });
    if (!freeze) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Freeze not found',
      });
    }
    if (freeze.status !== 'pending_review') {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Only freezes in pending_review can be approved. Current status: ${freeze.status}`,
      });
    }

    // Spec Requirement: Segregation of duties - block approving a freeze you requested yourself
    if (freeze.requestedBy && actorUserId && freeze.requestedBy === actorUserId) {
      throw new BadRequestException({
        code: 'SELF_APPROVAL_PROHIBITED',
        message: 'Staff cannot approve their own freeze request',
      });
    }

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const gymTimezone = gym?.timezone || 'Asia/Dubai';
    const today = getGymLocalDate(gymTimezone);

    // Spec Requirement: Approval staleness check - reject requests whose start date has passed
    if (freeze.startDate < today) {
      throw new BadRequestException({
        code: 'APPROVAL_STALE',
        message: 'Cannot approve freeze whose start date has already passed. Request must be re-submitted.',
      });
    }

    // Spec Requirement: Re-run all eligibility checks upon approval
    const recheck = await this.checkFreezeEligibility(gymId, freeze.membershipId, {
      startDate: freeze.startDate,
      endDate: freeze.endDate,
      waiveNotice: true,
    });
    if (!recheck.isEligible) {
      throw new BadRequestException({
        code: recheck.reasons[0] || 'MEMBERSHIP_NOT_ELIGIBLE',
        message: `Freeze no longer eligible for approval: ${recheck.reasons.join(', ')}`,
        reasons: recheck.reasons,
      });
    }

    const shouldBeActive = freeze.startDate <= today;
    const newStatus = shouldBeActive ? 'active' : 'scheduled';

    return await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(membershipFreezes)
        .set({
          status: newStatus,
          reviewedBy: toUuidOrNull(actorUserId),
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(scopeEntityToGym(membershipFreezes, gymId, freezeId))
        .returning();

      if (shouldBeActive) {
        const membership = await tx.query.memberships.findFirst({
          where: scopeEntityToGym(memberships, gymId, freeze.membershipId),
        });
        if (membership && membership.status !== 'frozen') {
          await tx
            .update(memberships)
            .set({
              status: 'frozen',
              statusBeforeFreeze: membership.status,
              version: membership.version + 1,
              updatedAt: new Date(),
            })
            .where(
              and(
                scopeEntityToGym(memberships, gymId, freeze.membershipId),
                eq(memberships.version, membership.version),
              ),
            );
        }
      }

      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'freeze.approve',
        entityType: 'membership_freeze',
        entityId: freezeId,
        payload: {
          previousStatus: freeze.status,
          newStatus,
          startDate: freeze.startDate,
          endDate: freeze.endDate,
        },
      });

      return updated;
    });
  }

  /**
   * Reject pending freeze request with mandatory reason (Owner or Manager)
   */
  async rejectFreeze(
    gymId: string,
    freezeId: string,
    rejectionReason: string,
    actorUserId?: string,
  ) {
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'A rejection reason of at least 5 characters is mandatory',
      });
    }

    const freeze = await this.db.query.membershipFreezes.findFirst({
      where: scopeEntityToGym(membershipFreezes, gymId, freezeId),
    });
    if (!freeze) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Freeze not found',
      });
    }
    if (freeze.status !== 'pending_review') {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Only freezes in pending_review can be rejected. Current status: ${freeze.status}`,
      });
    }

    const [updated] = await this.db
      .update(membershipFreezes)
      .set({
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        reviewedBy: toUuidOrNull(actorUserId),
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(scopeEntityToGym(membershipFreezes, gymId, freezeId))
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'freeze.reject',
      entityType: 'membership_freeze',
      entityId: freezeId,
      payload: {
        rejectionReason: rejectionReason.trim(),
      },
    });

    return updated;
  }

  /**
   * Cancel a scheduled or pending freeze request
   */
  async cancelFreeze(gymId: string, freezeId: string, actorUserId?: string) {
    const freeze = await this.db.query.membershipFreezes.findFirst({
      where: scopeEntityToGym(membershipFreezes, gymId, freezeId),
    });
    if (!freeze) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Freeze not found',
      });
    }
    if (freeze.status !== 'pending_review' && freeze.status !== 'scheduled') {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Only scheduled or pending freezes can be cancelled. Current status: ${freeze.status}`,
      });
    }

    const [updated] = await this.db
      .update(membershipFreezes)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(scopeEntityToGym(membershipFreezes, gymId, freezeId))
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'freeze.cancel',
      entityType: 'membership_freeze',
      entityId: freezeId,
      payload: {
        cancelledAt: new Date().toISOString(),
      },
    });

    return updated;
  }

  /**
   * Desk Early Lift (Spec Section 7.4)
   * Formula: days_used = A - S. days_charged = min(N, max(days_used, min_days))
   * Updates membership end date via membership_adjustments ledger and restores unused days.
   * Server strictly enforces local date for lifted_on.
   */
  async liftFreezeEarly(
    gymId: string,
    freezeId: string,
    input: EarlyLiftFreezeInput,
    actorUserId?: string,
    actorRole?: string,
  ) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const gymTimezone = gym?.timezone || 'Asia/Dubai';
    const today = getGymLocalDate(gymTimezone);
    // Server enforces liftedOn date to prevent client spoofing
    const effectiveLiftedOn = today;

    const freeze = await this.db.query.membershipFreezes.findFirst({
      where: scopeEntityToGym(membershipFreezes, gymId, freezeId),
    });
    if (!freeze) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Freeze not found',
      });
    }

    if (freeze.status !== 'active') {
      throw new BadRequestException({
        code: 'FREEZE_NOT_ACTIVE',
        message: `Only active freezes can be lifted early. Current status is ${freeze.status}`,
      });
    }

    // Spec Requirement: Lifted on or after end date counts as a normal completion
    if (effectiveLiftedOn >= freeze.endDate) {
      await this.settleDueFreezesForMembership(gymId, freeze.membershipId, today);
      const completed = await this.db.query.membershipFreezes.findFirst({
        where: scopeEntityToGym(membershipFreezes, gymId, freezeId),
      });
      return {
        freeze: completed,
        message: 'Freeze has reached its end date and has been completed normally.',
      };
    }

    // Spec Requirement: Lifted before start date is a cancellation with nothing charged
    if (effectiveLiftedOn < freeze.startDate) {
      return await this.db.transaction(async (tx) => {
        const [cancelledFreeze] = await tx
          .update(membershipFreezes)
          .set({
            status: 'cancelled',
            liftedOn: effectiveLiftedOn,
            daysCharged: 0,
            updatedAt: new Date(),
          })
          .where(scopeEntityToGym(membershipFreezes, gymId, freezeId))
          .returning();

        await this.auditService.log({
          gymId,
          actorUserId: actorUserId ?? null,
          action: 'freeze.cancel_before_start',
          entityType: 'membership_freeze',
          entityId: freeze.id,
          payload: {
            liftedOn: effectiveLiftedOn,
            daysCharged: 0,
          },
        });

        return {
          freeze: cancelledFreeze,
          daysCharged: 0,
          daysReturned: 0,
          message: 'Freeze cancelled before start date with zero days charged.',
        };
      });
    }

    // Front Desk PIN step-up validation: PIN is verified and NEVER logged
    if (actorRole === 'front_desk') {
      const expectedPin = (gym?.settings as any)?.managerPin || '1234';
      if (!input.managerPin || input.managerPin !== expectedPin) {
        throw new BadRequestException({
          code: 'INVALID_MANAGER_PIN',
          message: 'Manager PIN authorization required for front desk early lift',
        });
      }
    }

    // Fetch membership
    const membership = await this.db.query.memberships.findFirst({
      where: scopeEntityToGym(memberships, gymId, freeze.membershipId),
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Membership not found',
      });
    }

    // Date math
    const policyMinDays = (freeze.policySnapshot as any)?.minDays ?? 7;
    const freezeMath = calculateFreezeMath({
      currentEndDate: membership.endDate,
      startDate: freeze.startDate,
      endDate: freeze.endDate,
      minDays: policyMinDays,
      earlyReturnDate: effectiveLiftedOn,
    });

    const { daysCharged, daysReturned, projectedEndDate, daysUsed } = freezeMath;

    return await this.db.transaction(async (tx) => {
      // 1. Update freeze record
      const [updatedFreeze] = await tx
        .update(membershipFreezes)
        .set({
          status: 'early_lifted',
          liftedOn: effectiveLiftedOn,
          daysCharged,
          updatedAt: new Date(),
        })
        .where(
          and(
            scopeEntityToGym(membershipFreezes, gymId, freezeId),
            eq(membershipFreezes.status, 'active'), // Concurrency lock: must still be active
          ),
        )
        .returning();

      if (!updatedFreeze) {
        throw new ConflictException({
          code: 'FREEZE_NOT_ACTIVE',
          message: 'Freeze was already modified or lifted concurrently',
        });
      }

      // 2. Extend membership by daysCharged and restore active status
      const previousEndDate = membership.endDate;
      const [updatedMembership] = await tx
        .update(memberships)
        .set({
          endDate: projectedEndDate,
          status: (membership.statusBeforeFreeze as any) || 'active',
          statusBeforeFreeze: null,
          version: membership.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            scopeEntityToGym(memberships, gymId, membership.id),
            eq(memberships.version, membership.version),
          ),
        )
        .returning();

      if (!updatedMembership) {
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: 'Membership was concurrently modified',
        });
      }

      // 3. Insert into membership_adjustments ledger (guarded by adjustment_once_per_freeze unique index)
      try {
        await tx.insert(membershipAdjustments).values({
          gymId,
          membershipId: membership.id,
          kind: 'freeze_early_lift',
          previousEndDate,
          newEndDate: projectedEndDate,
          freezeId: freeze.id,
          reason:
            input.reason ||
            `Early freeze lift on ${effectiveLiftedOn} (${daysCharged} days charged, ${daysReturned} days returned to quota)`,
          createdBy: toUuidOrNull(actorUserId),
        });
      } catch (err: any) {
        const errCode = err?.code || err?.cause?.code;
        const errMsg = `${err?.message || ''} ${err?.cause?.message || ''}`;
        const constraint = err?.constraint || err?.cause?.constraint;

        if (
          constraint === 'adjustment_once_per_freeze' ||
          errMsg.toLowerCase().includes('adjustment_once_per_freeze')
        ) {
          throw new ConflictException({
            code: 'FREEZE_ALREADY_LIFTED',
            message: 'This freeze has already been lifted or settled in the ledger',
          });
        }

        if (errCode === '23505') {
          this.logger.error(`Unique constraint violation on constraint '${constraint || 'unknown'}': ${errMsg}`);
          throw new ConflictException({
            code: 'RESOURCE_CONFLICT',
            message: 'A conflicting record already exists',
          });
        }
        throw err;
      }

      // 4. Append audit log (PIN is strictly excluded; authorizing manager recorded)
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'freeze.lift',
        entityType: 'membership_freeze',
        entityId: freeze.id,
        payload: {
          liftedOn: effectiveLiftedOn,
          daysUsed,
          daysCharged,
          daysReturned,
          previousEndDate,
          newEndDate: projectedEndDate,
          authorizingRole: actorRole,
        },
      });

      return {
        freeze: updatedFreeze,
        membership: updatedMembership,
        daysCharged,
        daysReturned,
        newEndDate: projectedEndDate,
      };
    });
  }

  /**
   * Purge expired proofs older than deleteAfter date
   */
  async purgeExpiredProofs(gymId: string) {
    const gym = await this.db.query.gyms.findFirst({ where: eq(gyms.id, gymId) });
    const today = getGymLocalDate(gym?.timezone || 'Asia/Dubai');

    const expiredProofs = await this.db.query.freezeProofs.findMany({
      where: and(
        eq(freezeProofs.gymId, gymId),
        sql`${freezeProofs.deleteAfter} < ${today}`,
      ),
    });

    if (expiredProofs.length === 0) {
      return { purgedCount: 0 };
    }

    const proofIds = expiredProofs.map((p) => p.id);
    await this.db
      .delete(freezeProofs)
      .where(and(eq(freezeProofs.gymId, gymId), inArray(freezeProofs.id, proofIds)));

    await this.auditService.log({
      gymId,
      action: 'freeze.proof_purge',
      entityType: 'freeze_proof',
      payload: { purgedCount: proofIds.length, today },
    });

    return { purgedCount: proofIds.length };
  }

  /**
   * Attach proof document to freeze (30-day retention post-verification)
   */
  async attachProof(
    gymId: string,
    freezeId: string,
    input: {
      storageKey: string;
      mimeType?: 'application/pdf' | 'image/jpeg' | 'image/png';
      sizeBytes?: number;
      sha256?: string;
    },
    actorUserId?: string,
  ) {
    const freeze = await this.db.query.membershipFreezes.findFirst({
      where: scopeEntityToGym(membershipFreezes, gymId, freezeId),
    });
    if (!freeze) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Freeze not found',
      });
    }

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const gymTimezone = gym?.timezone || 'Asia/Dubai';
    const today = getGymLocalDate(gymTimezone);

    const [proof] = await this.db
      .insert(freezeProofs)
      .values({
        gymId,
        freezeId,
        storageKey: input.storageKey,
        mimeType: input.mimeType ?? 'application/pdf',
        sizeBytes: input.sizeBytes ?? 1024,
        sha256: input.sha256 ?? 'sha256_placeholder',
        reviewStatus: 'pending',
        deleteAfter: addDays(today, 30),
        uploadedBy: toUuidOrNull(actorUserId),
      })
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'freeze.proof_upload',
      entityType: 'freeze_proof',
      entityId: proof.id,
      payload: {
        freezeId,
        storageKey: input.storageKey,
      },
    });

    return proof;
  }
}
