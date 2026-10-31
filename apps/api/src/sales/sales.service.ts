import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
  branches,
  gyms,
  invoiceCounters,
  invoices,
  members,
  membershipAdjustments,
  memberships,
  payments,
  plans,
  shifts,
  users,
} from '../db/schema';
import {
  addDays,
  computeInclusiveEndDate,
  calculateVatInclusive,
  formatDateOnly,
  createSaleMembershipSchema,
  createRenewalSaleSchema,
  type CreateSaleMembershipInput,
  type CreateRenewalSaleInput,
} from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';
import { getGymLocalDate } from '../common/utils/dates';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Atomic, server-priced new membership sale (Guide Step 3)
   *
   * 1. Requires Idempotency-Key
   * 2. Checks SaaS payment restriction & gym status
   * 3. Pulls price directly from database (plans.priceMinor)
   * 4. Enforces open cashier shift for cash/card_pos
   * 5. Validates discount (owner/manager only, resulting price > 0)
   * 6. Executes in ONE transaction: membership (pending) -> payment (succeeded)
   *    -> invoice (tax_invoice or receipt) -> membership (active) -> adjustment (purchase) -> audit
   */
  async sellMembership(
    gymId: string,
    rawInput: unknown,
    actorUserId?: string,
    actorRole?: string,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'The Idempotency-Key header is required for membership sales',
      });
    }

    const trimmedKey = idempotencyKey.trim();

    const parseResult = createSaleMembershipSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid membership sale data',
        invalidParams: parseResult.error.issues.map((i) => ({
          name: i.path.join('.'),
          reason: i.message,
        })),
      });
    }

    const input: CreateSaleMembershipInput = parseResult.data;
    const requestHash = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');

    // 1. Check Idempotency Key
    const existingPayment = await this.db.query.payments.findFirst({
      where: and(
        eq(payments.gymId, gymId),
        eq(payments.idempotencyKey, trimmedKey),
      ),
    });

    if (existingPayment) {
      if (existingPayment.requestHash === requestHash) {
        // Idempotent duplicate: return existing records
        const invoice = await this.db.query.invoices.findFirst({
          where: and(
            eq(invoices.gymId, gymId),
            eq(invoices.paymentId, existingPayment.id),
          ),
        });
        const membership = existingPayment.membershipId
          ? await this.db.query.memberships.findFirst({
              where: scopeEntityToGym(memberships, gymId, existingPayment.membershipId),
            })
          : null;

        return {
          payment: existingPayment,
          invoice: invoice ?? null,
          membership: membership ?? null,
          cached: true,
        };
      } else {
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key has already been used with different request parameters',
        });
      }
    }

    // 2. Platform SaaS Subscription & Gym Status Check
    await this.subscriptionsService.checkPaymentAllowed(gymId);

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }
    if (gym.status === 'suspended' || gym.status === 'closed') {
      throw new ForbiddenException({
        code: 'GYM_STATUS_RESTRICTED',
        message: `Cannot process sales: gym is currently ${gym.status}`,
      });
    }

    // 3. Plan & Server-Side Price Resolution
    const plan = await this.db.query.plans.findFirst({
      where: scopeEntityToGym(plans, gymId, input.planId),
    });
    if (!plan || !plan.isActive) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found or inactive',
      });
    }

    const basePriceMinor = Number(plan.priceMinor);
    const currency = gym.currency;

    // 4. Start & End Date Calculations
    const gymTimezone = gym.timezone || 'Asia/Dubai';
    const today = getGymLocalDate(gymTimezone);
    const startDate = input.startDate || today;

    if (startDate < today) {
      throw new BadRequestException({
        code: 'START_DATE_IN_PAST',
        message: 'Membership start date cannot be in the past',
      });
    }

    const maxAllowedStartDate = addDays(today, 60);
    if (startDate > maxAllowedStartDate) {
      throw new BadRequestException({
        code: 'START_DATE_TOO_FAR',
        message: 'Membership start date cannot exceed 60 days in advance',
      });
    }

    const endDate = computeInclusiveEndDate(
      startDate,
      plan.durationUnit,
      plan.durationValue,
    );

    // 5. Discount Validation
    let discountAmountMinor = 0;
    if (input.discount) {
      if (actorRole !== 'owner' && actorRole !== 'manager') {
        throw new ForbiddenException({
          code: 'DISCOUNT_UNAUTHORIZED',
          message: 'Only gym owners and managers are authorized to apply discounts',
        });
      }

      if (input.discount.type === 'percent') {
        const pct = input.discount.value;
        if (pct <= 0 || pct >= 100) {
          throw new BadRequestException({
            code: 'INVALID_DISCOUNT',
            message: 'Percentage discount must be between 1 and 99',
          });
        }
        discountAmountMinor = Math.round((basePriceMinor * pct) / 100);
      } else {
        const amt = Math.round(input.discount.value);
        if (amt <= 0 || amt >= basePriceMinor) {
          throw new BadRequestException({
            code: 'INVALID_DISCOUNT',
            message: 'Discount amount must be positive and less than the plan price',
          });
        }
        discountAmountMinor = amt;
      }
    }

    const finalTotalMinor = basePriceMinor - discountAmountMinor;
    if (finalTotalMinor <= 0) {
      throw new BadRequestException({
        code: 'INVALID_DISCOUNT',
        message: 'Discount cannot reduce price to zero. Zero-cost memberships must use the complimentary flow.',
      });
    }

    // 6. Cashier Shift Resolution (Cash & POS Card)
    let shiftId: string | null = null;
    if (input.method === 'cash' || input.method === 'card_pos') {
      if (!actorUserId) {
        throw new BadRequestException({
          code: 'SHIFT_NOT_OPEN',
          message: 'A cashier user context is required for desk payments',
        });
      }

      const openShift = await this.db.query.shifts.findFirst({
        where: and(
          eq(shifts.gymId, gymId),
          eq(shifts.openedBy, actorUserId),
          eq(shifts.branchId, input.branchId),
          eq(shifts.status, 'open'),
          isNull(shifts.closedAt),
        ),
      });

      if (!openShift) {
        throw new BadRequestException({
          code: 'SHIFT_NOT_OPEN',
          message: 'An active, open cashier shift operated by you at this branch is required for desk payments',
        });
      }

      shiftId = openShift.id;
    }

    // 7. Verify Member
    const member = await this.db
      .select({
        id: members.id,
        memberNumber: members.memberNumber,
        homeBranchId: members.homeBranchId,
        user: {
          id: users.id,
          fullName: users.fullName,
          phone: users.phone,
          email: users.email,
        },
      })
      .from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(scopeEntityToGym(members, gymId, input.memberId))
      .limit(1);

    if (member.length === 0) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Member not found',
      });
    }
    const memberData = member[0];

    // 8. VAT Integer Math
    const vatRateBps = gym.vatRegistered ? 500 : 0;
    const vatBreakdown = calculateVatInclusive(BigInt(finalTotalMinor), vatRateBps);

    // 9. Atomic Transaction
    return await this.db.transaction(async (tx) => {
      // Step A: Insert membership with status 'pending_payment'
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

      const [newMembership] = await tx
        .insert(memberships)
        .values({
          gymId,
          memberId: input.memberId,
          planId: input.planId,
          branchId: input.branchId,
          startDate,
          originalEndDate: endDate,
          endDate,
          planSnapshot,
          status: 'pending_payment',
          version: 1,
        })
        .returning();

      // Step B: Insert payment row
      const [payment] = await tx
        .insert(payments)
        .values({
          gymId,
          branchId: input.branchId,
          memberId: input.memberId,
          membershipId: newMembership.id,
          shiftId,
          purpose: 'membership',
          method: input.method,
          status: 'succeeded',
          currency,
          totalMinor: finalTotalMinor,
          baseMinor: Number(vatBreakdown.baseMinor),
          vatMinor: Number(vatBreakdown.vatMinor),
          vatRateBps,
          idempotencyKey: trimmedKey,
          requestHash,
          provider: input.method === 'cash' ? 'cash' : 'card_pos',
          settledAt: new Date(),
          recordedBy: actorUserId ?? null,
        })
        .returning();

      // Step C: Sequential Gapless Invoice / Receipt
      const docType = gym.vatRegistered ? 'tax_invoice' : 'receipt';
      const series = gym.vatRegistered ? 'INV' : 'REC';

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
      const issuedOn = today;

      const invoiceLines = [
        {
          description: `${plan.title} (${plan.durationValue} ${plan.durationUnit}s)`,
          totalMinor: basePriceMinor,
          baseMinor: Number(calculateVatInclusive(BigInt(basePriceMinor), vatRateBps).baseMinor),
          vatMinor: Number(calculateVatInclusive(BigInt(basePriceMinor), vatRateBps).vatMinor),
          vatRateBps,
        },
      ];

      if (discountAmountMinor > 0) {
        invoiceLines.push({
          description: `Discount: ${input.discount?.reasonCode || 'Discretionary discount'}`,
          totalMinor: -discountAmountMinor,
          baseMinor: -Number(calculateVatInclusive(BigInt(discountAmountMinor), vatRateBps).baseMinor),
          vatMinor: -Number(calculateVatInclusive(BigInt(discountAmountMinor), vatRateBps).vatMinor),
          vatRateBps,
        });
      }

      const [invoice] = await tx
        .insert(invoices)
        .values({
          gymId,
          paymentId: payment.id,
          docType,
          series,
          number: assignedNumber,
          invoiceNumber,
          issuedOn,
          currency,
          supplier: {
            legalName: gym.legalName,
            tradeName: gym.tradeName,
            trnNumber: gym.trnNumber ?? null,
            tradeLicenseNumber: gym.tradeLicenseNumber,
          },
          buyer: {
            fullName: memberData.user.fullName,
            phone: memberData.user.phone,
            email: memberData.user.email,
            memberNumber: memberData.memberNumber,
          },
          lines: invoiceLines,
          totals: {
            totalMinor: finalTotalMinor,
            baseMinor: Number(vatBreakdown.baseMinor),
            vatMinor: Number(vatBreakdown.vatMinor),
            vatRateBps,
            currency,
          },
        })
        .returning();

      // Step D: Flip membership to 'active'
      const [activeMembership] = await tx
        .update(memberships)
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where(scopeEntityToGym(memberships, gymId, newMembership.id))
        .returning();

      // Step E: Insert membership_adjustments ledger row
      await tx.insert(membershipAdjustments).values({
        gymId,
        membershipId: activeMembership.id,
        kind: 'purchase',
        previousEndDate: startDate,
        newEndDate: endDate,
        paymentId: payment.id,
        reason: `Initial membership purchase: ${plan.title}`,
        createdBy: actorUserId ?? null,
      });

      // Step F: Increment cashier shift cash float if paid by cash
      if (input.method === 'cash' && shiftId) {
        await tx
          .update(shifts)
          .set({
            cashSalesMinor: sql`${shifts.cashSalesMinor} + ${finalTotalMinor}`,
          })
          .where(eq(shifts.id, shiftId));
      }

      // Step G: Transactional Audit Log
      await this.auditService.log(
        {
          gymId,
          actorUserId: actorUserId ?? null,
          actorRole,
          action: 'sale.membership',
          entityType: 'membership',
          entityId: activeMembership.id,
          payload: {
            planId: plan.id,
            planName: plan.title,
            totalMinor: finalTotalMinor,
            currency,
            startDate,
            endDate,
            invoiceNumber,
            discountAmountMinor,
          },
        },
        tx,
      );

      return {
        membership: activeMembership,
        payment,
        invoice,
      };
    });
  }

  /**
   * Consolidated, server-priced membership renewal (Guide Step 4)
   *
   * 1. Requires Idempotency-Key
   * 2. Pessimistically locks membership with SELECT ... FOR UPDATE
   * 3. Checks allowed statuses (active, frozen, expired)
   * 4. Enforces date continuity & month clamping
   * 5. Executes in ONE transaction: payment -> invoice -> membership extension -> adjustment -> audit
   */
  async renewMembership(
    gymId: string,
    rawInput: unknown,
    actorUserId?: string,
    actorRole?: string,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'The Idempotency-Key header is required for membership renewals',
      });
    }

    const trimmedKey = idempotencyKey.trim();

    const parseResult = createRenewalSaleSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid membership renewal data',
        invalidParams: parseResult.error.issues.map((i) => ({
          name: i.path.join('.'),
          reason: i.message,
        })),
      });
    }

    const input: CreateRenewalSaleInput = parseResult.data;
    const requestHash = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');

    // 1. Idempotency Check
    const existingPayment = await this.db.query.payments.findFirst({
      where: and(
        eq(payments.gymId, gymId),
        eq(payments.idempotencyKey, trimmedKey),
      ),
    });

    if (existingPayment) {
      if (existingPayment.requestHash === requestHash) {
        const invoice = await this.db.query.invoices.findFirst({
          where: and(
            eq(invoices.gymId, gymId),
            eq(invoices.paymentId, existingPayment.id),
          ),
        });
        const membership = existingPayment.membershipId
          ? await this.db.query.memberships.findFirst({
              where: scopeEntityToGym(memberships, gymId, existingPayment.membershipId),
            })
          : null;

        return {
          payment: existingPayment,
          invoice: invoice ?? null,
          membership: membership ?? null,
          cached: true,
        };
      } else {
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key has already been used with different request parameters',
        });
      }
    }

    // 2. Platform SaaS Subscription & Gym Status Check
    await this.subscriptionsService.checkPaymentAllowed(gymId);

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }
    if (gym.status === 'suspended' || gym.status === 'closed') {
      throw new ForbiddenException({
        code: 'GYM_STATUS_RESTRICTED',
        message: `Cannot process renewal: gym is currently ${gym.status}`,
      });
    }

    return await this.db.transaction(async (tx) => {
      // Step A: Lock membership row with FOR UPDATE
      const memRows = await tx.execute<{
        id: string;
        gym_id: string;
        member_id: string;
        plan_id: string;
        branch_id: string | null;
        start_date: string;
        end_date: string;
        status: string;
        cancel_effective_date: string | null;
        version: number;
      }>(
        sql`SELECT id, gym_id, member_id, plan_id, branch_id, start_date, end_date, status, cancel_effective_date, version
            FROM memberships
            WHERE gym_id = ${gymId} AND id = ${input.membershipId}
            FOR UPDATE`,
      );

      const memRow = memRows.rows?.[0] ?? (memRows as any)?.[0];
      if (!memRow) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Membership not found',
        });
      }

      if (memRow.status === 'cancelled') {
        throw new BadRequestException({
          code: 'MEMBERSHIP_CANCELLED',
          message: 'Cancelled memberships cannot be renewed',
        });
      }

      if (memRow.cancel_effective_date) {
        throw new BadRequestException({
          code: 'MEMBERSHIP_CANCEL_PENDING',
          message: 'Memberships with a pending cancellation notice cannot be renewed',
        });
      }

      const planId = input.planId || memRow.plan_id;
      const plan = await tx.query.plans.findFirst({
        where: scopeEntityToGym(plans, gymId, planId),
      });
      if (!plan || !plan.isActive) {
        throw new NotFoundException({
          code: 'PLAN_NOT_FOUND',
          message: 'Plan not found or inactive',
        });
      }

      const basePriceMinor = Number(plan.priceMinor);
      const currency = gym.currency;

      // Step B: Discounts
      let discountAmountMinor = 0;
      if (input.discount) {
        if (actorRole !== 'owner' && actorRole !== 'manager') {
          throw new ForbiddenException({
            code: 'DISCOUNT_UNAUTHORIZED',
            message: 'Only gym owners and managers are authorized to apply discounts',
          });
        }

        if (input.discount.type === 'percent') {
          const pct = input.discount.value;
          if (pct <= 0 || pct >= 100) {
            throw new BadRequestException({
              code: 'INVALID_DISCOUNT',
              message: 'Percentage discount must be between 1 and 99',
            });
          }
          discountAmountMinor = Math.round((basePriceMinor * pct) / 100);
        } else {
          const amt = Math.round(input.discount.value);
          if (amt <= 0 || amt >= basePriceMinor) {
            throw new BadRequestException({
              code: 'INVALID_DISCOUNT',
              message: 'Discount amount must be positive and less than the plan price',
            });
          }
          discountAmountMinor = amt;
        }
      }

      const finalTotalMinor = basePriceMinor - discountAmountMinor;
      if (finalTotalMinor <= 0) {
        throw new BadRequestException({
          code: 'INVALID_DISCOUNT',
          message: 'Discount cannot reduce price to zero. Zero-cost renewals must use complimentary adjustments.',
        });
      }

      // Step C: Shift Check
      let shiftId: string | null = null;
      const branchId = input.branchId || memRow.branch_id;
      if (input.method === 'cash' || input.method === 'card_pos') {
        if (!actorUserId || !branchId) {
          throw new BadRequestException({
            code: 'SHIFT_NOT_OPEN',
            message: 'A cashier user context and branch are required for desk payments',
          });
        }

        const openShift = await tx.query.shifts.findFirst({
          where: and(
            eq(shifts.gymId, gymId),
            eq(shifts.openedBy, actorUserId),
            eq(shifts.branchId, branchId),
            eq(shifts.status, 'open'),
            isNull(shifts.closedAt),
          ),
        });

        if (!openShift) {
          throw new BadRequestException({
            code: 'SHIFT_NOT_OPEN',
            message: 'An active, open cashier shift operated by you at this branch is required for desk payments',
          });
        }
        shiftId = openShift.id;
      }

      // Step D: Renewal Date Continuity & Month Clamping
      const gymTimezone = gym.timezone || 'Asia/Dubai';
      const today = getGymLocalDate(gymTimezone);
      const currentEndDate = memRow.end_date;

      let newStartDate: string;
      // If paid on or before currentEndDate, start next day (date continuity)
      if (today <= currentEndDate) {
        newStartDate = addDays(currentEndDate, 1);
      } else {
        // Expired renewal starts today
        newStartDate = today;
      }

      const newEndDate = computeInclusiveEndDate(
        newStartDate,
        plan.durationUnit,
        plan.durationValue,
      );

      // Step E: Member info for invoice
      const member = await tx
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
        .where(scopeEntityToGym(members, gymId, memRow.member_id))
        .limit(1);

      const memberData = member[0];

      // Step F: VAT Calculation
      const vatRateBps = gym.vatRegistered ? 500 : 0;
      const vatBreakdown = calculateVatInclusive(BigInt(finalTotalMinor), vatRateBps);

      // Step G: Insert payment row
      const [payment] = await tx
        .insert(payments)
        .values({
          gymId,
          branchId,
          memberId: memRow.member_id,
          membershipId: memRow.id,
          shiftId,
          purpose: 'renewal',
          method: input.method,
          status: 'succeeded',
          currency,
          totalMinor: finalTotalMinor,
          baseMinor: Number(vatBreakdown.baseMinor),
          vatMinor: Number(vatBreakdown.vatMinor),
          vatRateBps,
          idempotencyKey: trimmedKey,
          requestHash,
          provider: input.method === 'cash' ? 'cash' : 'card_pos',
          settledAt: new Date(),
          recordedBy: actorUserId ?? null,
        })
        .returning();

      // Step H: Gapless Invoice
      const docType = gym.vatRegistered ? 'tax_invoice' : 'receipt';
      const series = gym.vatRegistered ? 'INV' : 'REC';

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

      const invoiceLines = [
        {
          description: `Membership Renewal: ${plan.title} (${plan.durationValue} ${plan.durationUnit}s)`,
          totalMinor: basePriceMinor,
          baseMinor: Number(calculateVatInclusive(BigInt(basePriceMinor), vatRateBps).baseMinor),
          vatMinor: Number(calculateVatInclusive(BigInt(basePriceMinor), vatRateBps).vatMinor),
          vatRateBps,
        },
      ];

      if (discountAmountMinor > 0) {
        invoiceLines.push({
          description: `Discount: ${input.discount?.reasonCode || 'Discretionary discount'}`,
          totalMinor: -discountAmountMinor,
          baseMinor: -Number(calculateVatInclusive(BigInt(discountAmountMinor), vatRateBps).baseMinor),
          vatMinor: -Number(calculateVatInclusive(BigInt(discountAmountMinor), vatRateBps).vatMinor),
          vatRateBps,
        });
      }

      const [invoice] = await tx
        .insert(invoices)
        .values({
          gymId,
          paymentId: payment.id,
          docType,
          series,
          number: assignedNumber,
          invoiceNumber,
          issuedOn: today,
          currency,
          supplier: {
            legalName: gym.legalName,
            tradeName: gym.tradeName,
            trnNumber: gym.trnNumber ?? null,
            tradeLicenseNumber: gym.tradeLicenseNumber,
          },
          buyer: {
            fullName: memberData?.user.fullName || 'Member',
            phone: memberData?.user.phone || null,
            email: memberData?.user.email || null,
            memberNumber: memberData?.memberNumber || null,
          },
          lines: invoiceLines,
          totals: {
            totalMinor: finalTotalMinor,
            baseMinor: Number(vatBreakdown.baseMinor),
            vatMinor: Number(vatBreakdown.vatMinor),
            vatRateBps,
            currency,
          },
        })
        .returning();

      // Step I: Update Membership Term
      const nextStatus = (memRow.status === 'expired' ? 'active' : memRow.status) as
        | 'pending_payment'
        | 'active'
        | 'frozen'
        | 'expired'
        | 'cancelled';
      const [updatedMembership] = await tx
        .update(memberships)
        .set({
          planId: plan.id,
          endDate: newEndDate,
          status: nextStatus,
          version: memRow.version + 1,
          updatedAt: new Date(),
        })
        .where(scopeEntityToGym(memberships, gymId, memRow.id))
        .returning();

      // Step J: Insert Adjustment
      await tx.insert(membershipAdjustments).values({
        gymId,
        membershipId: memRow.id,
        kind: 'renewal',
        previousEndDate: currentEndDate,
        newEndDate,
        paymentId: payment.id,
        reason: `Membership renewal: ${plan.title} to ${newEndDate}`,
        createdBy: actorUserId ?? null,
      });

      // Step K: Shift Cash Increment
      if (input.method === 'cash' && shiftId) {
        await tx
          .update(shifts)
          .set({
            cashSalesMinor: sql`${shifts.cashSalesMinor} + ${finalTotalMinor}`,
          })
          .where(eq(shifts.id, shiftId));
      }

      // Step L: Audit log inside tx
      await this.auditService.log(
        {
          gymId,
          actorUserId: actorUserId ?? null,
          actorRole,
          action: 'sale.renewal',
          entityType: 'membership',
          entityId: memRow.id,
          payload: {
            planId: plan.id,
            planName: plan.title,
            previousEndDate: currentEndDate,
            newEndDate,
            totalMinor: finalTotalMinor,
            currency,
            invoiceNumber,
            discountAmountMinor,
          },
        },
        tx,
      );

      return {
        membership: updatedMembership,
        payment,
        invoice,
      };
    });
  }
}
