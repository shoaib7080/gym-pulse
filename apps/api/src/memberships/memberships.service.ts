import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
  branches,
  gyms,
  invoiceCounters,
  invoices,
  members,
  membershipAdjustments,
  membershipFreezes,
  memberships,
  payments,
  plans,
  shifts,
  users,
} from '../db/schema';
import {
  addDays,
  calculateVatInclusive,
  formatDateOnly,
} from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';
import { FreezesService, toUuidOrNull } from '../freezes/freezes.service';
import { getGymLocalDate } from '../common/utils/dates';

export interface CreateMembershipDto {
  memberId: string;
  planId: string;
  branchId?: string;
  startDate?: string; // YYYY-MM-DD
}

export interface AdjustMembershipDto {
  days: number;
  reason: string;
  kind?: 'complimentary' | 'correction' | 'renewal';
}

export interface RenewMembershipDto {
  planId?: string;
  method?: 'cash' | 'card_pos' | 'bank_transfer';
  shiftId?: string;
  totalMinor?: number;
  currency?: string;
  providerReference?: string;
  reason?: string;
}

export interface CancelMembershipDto {
  cancelEffectiveDate?: string;
  reason: string;
}

@Injectable()
export class MembershipsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly freezesService: FreezesService,
  ) {}

  /**
   * Calculate inclusive end date from start date and plan duration
   * Spec Section 5.3: N days inclusive term: end_date = start_date + N - 1
   */
  public computeInclusiveEndDate(startDateStr: string, durationUnit: string, durationValue: number): string {
    const [y, m, d] = startDateStr.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));

    if (durationUnit === 'day') {
      return addDays(startDateStr, durationValue - 1);
    }

    if (durationUnit === 'month') {
      const end = new Date(Date.UTC(y, m - 1 + durationValue, d));
      end.setUTCDate(end.getUTCDate() - 1);
      return formatDateOnly(end);
    }

    return addDays(startDateStr, durationValue - 1);
  }

  /**
   * Provision a membership for a member with immutable plan snapshot
   */
  async createMembership(gymId: string, input: CreateMembershipDto, actorUserId?: string) {
    if (!input.memberId || !input.planId) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'memberId and planId are required',
      });
    }

    // 1. Verify member belongs to this gym
    const member = await this.db.query.members.findFirst({
      where: scopeEntityToGym(members, gymId, input.memberId),
    });
    if (!member) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Member not found',
      });
    }

    // 2. Verify plan belongs to this gym and is active
    const plan = await this.db.query.plans.findFirst({
      where: scopeEntityToGym(plans, gymId, input.planId),
    });
    if (!plan || !plan.isActive) {
      throw new BadRequestException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Plan not found or is currently inactive',
      });
    }

    // 3. Verify branch if provided
    let branchId = input.branchId ?? member.homeBranchId;
    if (branchId) {
      const branch = await this.db.query.branches.findFirst({
        where: scopeEntityToGym(branches, gymId, branchId),
      });
      if (!branch) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Specified branchId is invalid or belongs to another gym',
        });
      }
    }

    // 4. Determine start date and compute inclusive end date in gym timezone
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const today = getGymLocalDate(gym?.timezone || 'Asia/Dubai');
    const startDate = input.startDate || today;
    const endDate = this.computeInclusiveEndDate(startDate, plan.durationUnit, plan.durationValue);

    // 5. Build immutable plan snapshot (Spec Section 5.3)
    const planSnapshot = {
      planId: plan.id,
      title: plan.title,
      durationUnit: plan.durationUnit,
      durationValue: plan.durationValue,
      priceMinor: plan.priceMinor,
      priceIncludesVat: plan.priceIncludesVat,
      graceDays: plan.graceDays,
      branchAccess: plan.branchAccess,
    };

    return await this.db.transaction(async (tx) => {
      // 6. Insert membership row
      const [newMembership] = await tx
        .insert(memberships)
        .values({
          gymId,
          memberId: member.id,
          planId: plan.id,
          branchId,
          status: 'active',
          startDate,
          originalEndDate: endDate,
          endDate,
          planSnapshot,
          version: 1,
        })
        .returning();

      // 7. Record initial purchase entry in membership_adjustments ledger
      await tx.insert(membershipAdjustments).values({
        gymId,
        membershipId: newMembership.id,
        kind: 'purchase',
        previousEndDate: startDate,
        newEndDate: endDate,
        reason: `Initial membership purchase (${plan.title})`,
        createdBy: toUuidOrNull(actorUserId),
      });

      // 8. Append audit log
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'membership.create',
        entityType: 'membership',
        entityId: newMembership.id,
        payload: {
          memberId: member.id,
          planTitle: plan.title,
          startDate,
          endDate,
        },
      });

      return newMembership;
    });
  }

  /**
   * Get membership details with adjustments ledger (settles due freezes lazily upfront)
   */
  async getMembershipById(gymId: string, membershipId: string) {
    // Settle due freezes lazily upfront so caller gets the exact real-time state
    await this.freezesService.settleDueFreezesForMembership(gymId, membershipId);

    const membership = await this.db.query.memberships.findFirst({
      where: scopeEntityToGym(memberships, gymId, membershipId),
    });

    if (!membership) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Membership not found',
      });
    }

    const adjustments = await this.db.query.membershipAdjustments.findMany({
      where: scopeToGym(
        membershipAdjustments,
        gymId,
        eq(membershipAdjustments.membershipId, membershipId),
      ),
      orderBy: [desc(membershipAdjustments.createdAt)],
    });

    const member = await this.db.query.members.findFirst({
      where: scopeEntityToGym(members, gymId, membership.memberId),
    });

    return {
      ...membership,
      member,
      adjustments,
    };
  }

  /**
   * Adjust membership dates (Manager/Owner only, mandatory reason)
   * The only free path to extend a membership without payment.
   */
  async adjustMembership(
    gymId: string,
    membershipId: string,
    input: AdjustMembershipDto,
    actorUserId?: string,
  ) {
    if (!input.days || input.days === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Adjustment days must be a non-zero integer',
      });
    }

    if (!input.reason || input.reason.trim().length < 5) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'A detailed reason (at least 5 characters) is mandatory for date adjustments',
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

    const previousEndDate = membership.endDate;
    const newEndDate = addDays(previousEndDate, input.days);

    return await this.db.transaction(async (tx) => {
      // 1. Update membership end date and increment version
      const [updated] = await tx
        .update(memberships)
        .set({
          endDate: newEndDate,
          version: membership.version + 1,
          updatedAt: new Date(),
        })
        .where(scopeEntityToGym(memberships, gymId, membershipId))
        .returning();

      // 2. Insert into immutable adjustments ledger
      await tx.insert(membershipAdjustments).values({
        gymId,
        membershipId,
        kind: input.kind ?? 'complimentary',
        previousEndDate,
        newEndDate,
        reason: input.reason.trim(),
        createdBy: toUuidOrNull(actorUserId),
      });

      // 3. Append audit log
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'membership.adjust',
        entityType: 'membership',
        entityId: membershipId,
        payload: {
          previousEndDate,
          newEndDate,
          daysAdjusted: input.days,
          reason: input.reason,
        },
      });

      return updated;
    });
  }

  /**
   * Renew membership tied to a sale in one transaction (Spec Section 6.3)
   * Enforces payment, gapless tax invoice, and adjustment ledger linked to paymentId.
   * Continuous renewal if paid on or before end_date + grace_days (starts at end_date + 1).
   * Late renewal starts today.
   */
  async renewMembership(
    gymId: string,
    membershipId: string,
    input: RenewMembershipDto,
    actorUserId?: string,
  ) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    // Settle due freezes on this membership first
    await this.freezesService.settleDueFreezesForMembership(gymId, membershipId);

    const membership = await this.db.query.memberships.findFirst({
      where: scopeEntityToGym(memberships, gymId, membershipId),
    });

    if (!membership) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Membership not found',
      });
    }

    if (membership.status === 'cancelled') {
      throw new BadRequestException({
        code: 'MEMBERSHIP_CANCELLED',
        message: 'Cannot renew a cancelled membership. Provision a new membership instead.',
      });
    }

    // Payment validation: Cash requires open shift
    const paymentMethod = input.method || 'cash';
    if (paymentMethod === 'cash') {
      if (!input.shiftId) {
        throw new BadRequestException({
          code: 'SHIFT_NOT_OPEN',
          message: 'An active shiftId is required for cash renewals',
        });
      }

      const shift = await this.db.query.shifts.findFirst({
        where: scopeEntityToGym(shifts, gymId, input.shiftId),
      });
      if (!shift || shift.closedAt) {
        throw new BadRequestException({
          code: 'SHIFT_NOT_OPEN',
          message: 'The specified shift is not found or is already closed',
        });
      }
    }

    const targetPlanId = input.planId || membership.planId;
    const plan = await this.db.query.plans.findFirst({
      where: scopeEntityToGym(plans, gymId, targetPlanId),
    });
    if (!plan || !plan.isActive) {
      throw new BadRequestException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Target renewal plan not found or is currently inactive',
      });
    }

    const today = getGymLocalDate(gym.timezone || 'Asia/Dubai');

    // Continuous renewal if renewed on or before end_date + grace_days
    const graceCutoff = addDays(membership.endDate, plan.graceDays);
    const isContinuous = today <= graceCutoff;
    const renewalStartDate = isContinuous ? addDays(membership.endDate, 1) : today;
    const newEndDate = this.computeInclusiveEndDate(
      renewalStartDate,
      plan.durationUnit,
      plan.durationValue,
    );

    const previousEndDate = membership.endDate;

    // Financial calculations in integer minor units (fils)
    const totalMinor = input.totalMinor ?? plan.priceMinor;
    const vatRateBps = gym.vatRegistered ? 500 : 0;
    const vatBreakdown = calculateVatInclusive(totalMinor, vatRateBps);

    // Fetch member and user details for tax invoice buyer section
    const member = await this.db
      .select({
        id: members.id,
        memberNumber: members.memberNumber,
        user: {
          id: users.id,
          fullName: users.fullName,
          phone: users.phone,
          email: users.email,
        },
      })
      .from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(scopeEntityToGym(members, gymId, membership.memberId))
      .limit(1);

    const memberData = member[0];

    const planSnapshot = {
      planId: plan.id,
      title: plan.title,
      durationUnit: plan.durationUnit,
      durationValue: plan.durationValue,
      priceMinor: plan.priceMinor,
      priceIncludesVat: plan.priceIncludesVat,
      graceDays: plan.graceDays,
      branchAccess: plan.branchAccess,
    };

    return await this.db.transaction(async (tx) => {
      // 1. Insert payment record (Desk sale)
      const [payment] = await tx
        .insert(payments)
        .values({
          gymId,
          branchId: membership.branchId ?? null,
          memberId: membership.memberId,
          membershipId: membership.id,
          shiftId: input.shiftId ?? null,
          purpose: 'renewal',
          method: paymentMethod,
          status: 'succeeded',
          currency: input.currency ?? gym.currency,
          totalMinor: Number(vatBreakdown.totalMinor),
          baseMinor: Number(vatBreakdown.baseMinor),
          vatMinor: Number(vatBreakdown.vatMinor),
          vatRateBps,
          provider: paymentMethod === 'cash' ? 'cash' : 'card_pos',
          providerReference: input.providerReference ?? null,
          settledAt: new Date(),
          recordedBy: toUuidOrNull(actorUserId),
        })
        .returning();

      // 2. Atomic sequential invoice counter for series 'INV'
      const series = 'INV';
      const [counter] = await tx
        .insert(invoiceCounters)
        .values({
          gymId,
          series,
          nextNumber: 2,
        })
        .onConflictDoUpdate({
          target: [invoiceCounters.gymId, invoiceCounters.series],
          set: {
            nextNumber: sql`${invoiceCounters.nextNumber} + 1`,
          },
        })
        .returning({
          assignedNumber: sql<number>`${invoiceCounters.nextNumber} - 1`,
        });

      const assignedNumber = Number(counter?.assignedNumber || 1);
      const invoiceNumber = `${series}-${String(assignedNumber).padStart(6, '0')}`;

      // 3. Insert simplified tax invoice
      const [invoice] = await tx
        .insert(invoices)
        .values({
          gymId,
          paymentId: payment.id,
          docType: 'simplified_tax_invoice',
          series,
          number: assignedNumber,
          invoiceNumber,
          issuedOn: today,
          currency: payment.currency,
          supplier: {
            legalName: gym.legalName,
            tradeName: gym.tradeName,
            trnNumber: gym.trnNumber ?? null,
            tradeLicenseNumber: gym.tradeLicenseNumber,
          },
          buyer: memberData
            ? {
                fullName: memberData.user.fullName,
                phone: memberData.user.phone,
                email: memberData.user.email,
                memberNumber: memberData.memberNumber,
              }
            : {},
          lines: [
            {
              description: `Membership Renewal - ${plan.title}`,
              totalMinor: Number(vatBreakdown.totalMinor),
              baseMinor: Number(vatBreakdown.baseMinor),
              vatMinor: Number(vatBreakdown.vatMinor),
              vatRateBps,
            },
          ],
          totals: {
            totalMinor: Number(vatBreakdown.totalMinor),
            baseMinor: Number(vatBreakdown.baseMinor),
            vatMinor: Number(vatBreakdown.vatMinor),
            vatRateBps,
            currency: payment.currency,
          },
        })
        .returning();

      // 4. Update membership term (preserve frozen status if currently frozen)
      const isFrozen = membership.status === 'frozen';
      const [updated] = await tx
        .update(memberships)
        .set({
          planId: plan.id,
          planSnapshot,
          endDate: newEndDate,
          status: isFrozen ? 'frozen' : 'active',
          statusBeforeFreeze: isFrozen ? (membership.statusBeforeFreeze || 'active') : null,
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

      if (!updated) {
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: 'Membership was modified concurrently by another process',
        });
      }

      // 5. Insert into membership_adjustments ledger LINKED DIRECTLY to paymentId
      await tx.insert(membershipAdjustments).values({
        gymId,
        membershipId,
        kind: 'renewal',
        paymentId: payment.id,
        previousEndDate,
        newEndDate,
        reason:
          input.reason ||
          (isContinuous
            ? `Seamless continuous renewal (${plan.title})`
            : `Late renewal effective ${today} (${plan.title})`),
        createdBy: toUuidOrNull(actorUserId),
      });

      // 6. Append audit logs
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'payment.desk_sale',
        entityType: 'payment',
        entityId: payment.id,
        payload: {
          purpose: 'renewal',
          membershipId,
          method: paymentMethod,
          totalMinor: Number(vatBreakdown.totalMinor),
          invoiceNumber,
        },
      });

      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'membership.renew',
        entityType: 'membership',
        entityId: membershipId,
        payload: {
          previousEndDate,
          newEndDate,
          isContinuous,
          renewalStartDate,
          planTitle: plan.title,
          paymentId: payment.id,
          wasFrozen: isFrozen,
        },
      });

      return {
        ...updated,
        payment,
        invoice,
      };
    });
  }

  /**
   * Cancel membership with spec compliance (Spec Section 6.4)
   * - Roles: Owner or Manager only
   * - Mandatory explanation (at least 5 characters)
   * - Harmless if cancelled twice (idempotent)
   * - If immediate (effective <= today): flips status to cancelled directly (frozen -> cancelled without unfreeze)
   * - If notice period (effective > today): membership stays usable (status active) until effective date
   * - Writes a ledger row ONLY if end_date actually changes; otherwise relies on audit log.
   */
  async cancelMembership(
    gymId: string,
    membershipId: string,
    input: CancelMembershipDto,
    actorUserId?: string,
  ) {
    if (!input.reason || input.reason.trim().length < 5) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'A detailed reason (at least 5 characters) is required for cancellation',
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

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const today = getGymLocalDate(gym?.timezone || 'Asia/Dubai');
    const cancelEffectiveDate = input.cancelEffectiveDate || today;

    // Cancelling twice is harmless (idempotent)
    if (
      membership.status === 'cancelled' ||
      (membership.cancelEffectiveDate && membership.cancelEffectiveDate === cancelEffectiveDate)
    ) {
      return membership;
    }

    const isImmediate = cancelEffectiveDate <= today;
    const wasFrozen = membership.status === 'frozen';
    // If immediate, flips to cancelled; if notice period, stays usable in its current status
    const newStatus = isImmediate ? 'cancelled' : membership.status;

    // End date truncation: only change endDate if effective date truncates it
    const shouldTruncateEndDate = cancelEffectiveDate < membership.endDate;
    const newEndDate = shouldTruncateEndDate ? cancelEffectiveDate : membership.endDate;

    return await this.db.transaction(async (tx) => {
      // 1. Update membership with optimistic concurrency check
      const [updated] = await tx
        .update(memberships)
        .set({
          status: newStatus,
          statusBeforeFreeze: isImmediate ? null : membership.statusBeforeFreeze,
          cancelEffectiveDate,
          endDate: newEndDate,
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

      if (!updated) {
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: 'Membership was modified concurrently by another process',
        });
      }

      // 2. If immediate, terminate active or scheduled freezes without extension
      if (isImmediate) {
        await tx
          .update(membershipFreezes)
          .set({
            status: 'cancelled',
            rejectionReason: 'Cancelled due to membership termination',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(membershipFreezes.gymId, gymId),
              eq(membershipFreezes.membershipId, membershipId),
              inArray(membershipFreezes.status, ['active', 'scheduled', 'pending_review']),
            ),
          );
      }

      // 3. Write ledger row ONLY if end date actually changed
      if (shouldTruncateEndDate) {
        await tx.insert(membershipAdjustments).values({
          gymId,
          membershipId,
          kind: 'correction',
          previousEndDate: membership.endDate,
          newEndDate,
          reason: `Membership cancellation truncation: ${input.reason.trim()} (effective ${cancelEffectiveDate})`,
          createdBy: toUuidOrNull(actorUserId),
        });
      }

      // 4. Audit log
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'membership.cancel',
        entityType: 'membership',
        entityId: membershipId,
        payload: {
          cancelEffectiveDate,
          isImmediate,
          wasFrozen,
          endDateChanged: shouldTruncateEndDate,
          reason: input.reason.trim(),
        },
      });

      return updated;
    });
  }
}
