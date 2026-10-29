import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
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
  deskPaymentSchema,
  type DeskPaymentInput,
  voidPaymentSchema,
  type VoidPaymentInput,
  calculateVatInclusive,
  formatDateOnly,
  addDays,
} from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';
import { toUuidOrNull } from '../freezes/freezes.service';
import { getGymLocalDate } from '../common/utils/dates';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Process a front desk payment checkout (Cash, POS Card, or Bank Transfer)
   * Enforces:
   * 1. Cashier shift validation for cash payments
   * 2. Integer fils VAT math (round-half-up)
   * 3. Gapless atomic sequential invoice number generation (INV-000001)
   * 4. Immutable tax invoice creation
   * 5. Membership activation if applicable
   * 6. Tamper-evident cryptographic audit log
   * 7. SaaS subscription dunning restriction check
   */
  async createDeskPayment(gymId: string, rawInput: unknown, actorUserId?: string) {
    // Enforce platform SaaS subscription status
    await this.subscriptionsService.checkPaymentAllowed(gymId);

    const parseResult = deskPaymentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid desk payment data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: DeskPaymentInput = parseResult.data;

    // 1. Verify gym status
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
        message: `Cannot process payments: gym is currently ${gym.status}`,
      });
    }

    // 2. Verify shift if cash payment
    if (input.method === 'cash') {
      if (!input.shiftId) {
        throw new BadRequestException({
          code: 'SHIFT_NOT_OPEN',
          message: 'An active shiftId is required for cash payments',
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

    // 3. Verify member exists in gym
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

    // 4. Calculate VAT breakdown in minor units (fils/paise)
    const vatRateBps = gym.vatRegistered ? 500 : 0; // 5.00% VAT in UAE if registered
    const vatBreakdown = calculateVatInclusive(input.totalMinor, vatRateBps);

    // 5. Execute atomic transaction
    return await this.db.transaction(async (tx) => {
      // Insert payment row
      const [payment] = await tx
        .insert(payments)
        .values({
          gymId,
          branchId: memberData.homeBranchId ?? null,
          memberId: input.memberId,
          membershipId: input.membershipId ?? null,
          shiftId: input.shiftId ?? null,
          purpose: input.purpose,
          method: input.method,
          status: 'succeeded',
          currency: input.currency ?? gym.currency,
          totalMinor: Number(vatBreakdown.totalMinor),
          baseMinor: Number(vatBreakdown.baseMinor),
          vatMinor: Number(vatBreakdown.vatMinor),
          vatRateBps,
          provider: input.method === 'cash' ? 'cash' : 'card_pos',
          providerReference: input.providerReference ?? null,
          settledAt: new Date(),
          recordedBy: actorUserId ?? null,
        })
        .returning();

      // Sequential gapless invoice counter for series 'INV' (atomic upsert)
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
      const issuedOn = formatDateOnly(new Date());

      // Create simplified tax invoice (Spec Section 5.6)
      const [invoice] = await tx
        .insert(invoices)
        .values({
          gymId,
          paymentId: payment.id,
          docType: 'simplified_tax_invoice',
          series,
          number: assignedNumber,
          invoiceNumber,
          issuedOn,
          currency: payment.currency,
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
          lines: [
            {
              description: `Payment for ${input.purpose}`,
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

      // If membership payment, activate the membership
      if (input.purpose === 'membership' && input.membershipId) {
        await tx
          .update(memberships)
          .set({ status: 'active', updatedAt: new Date() })
          .where(scopeEntityToGym(memberships, gymId, input.membershipId));
      }

      // If renewal payment, execute renewal logic with continuity in same transaction
      if (input.purpose === 'renewal' && input.membershipId) {
        const mem = await tx.query.memberships.findFirst({
          where: scopeEntityToGym(memberships, gymId, input.membershipId),
        });
        if (mem && mem.status !== 'cancelled') {
          const targetPlan = await tx.query.plans.findFirst({
            where: scopeEntityToGym(plans, gymId, mem.planId),
          });
          if (targetPlan) {
            const today = getGymLocalDate(gym.timezone || 'Asia/Dubai');
            const graceCutoff = addDays(mem.endDate, targetPlan.graceDays);
            const isContinuous = today <= graceCutoff;
            const renewalStartDate = isContinuous ? addDays(mem.endDate, 1) : today;

            const [y, m, d] = renewalStartDate.split('-').map(Number);
            let newEndDate: string;
            if (targetPlan.durationUnit === 'month') {
              const end = new Date(Date.UTC(y, m - 1 + targetPlan.durationValue, d));
              end.setUTCDate(end.getUTCDate() - 1);
              newEndDate = formatDateOnly(end);
            } else {
              newEndDate = addDays(renewalStartDate, targetPlan.durationValue - 1);
            }

            await tx
              .update(memberships)
              .set({
                endDate: newEndDate,
                status: 'active',
                statusBeforeFreeze: null,
                version: mem.version + 1,
                updatedAt: new Date(),
              })
              .where(scopeEntityToGym(memberships, gymId, mem.id));

            await tx.insert(membershipAdjustments).values({
              gymId,
              membershipId: mem.id,
              kind: 'renewal',
              paymentId: payment.id,
              previousEndDate: mem.endDate,
              newEndDate,
              reason: isContinuous
                ? `Seamless continuous renewal (${targetPlan.title})`
                : `Late renewal effective ${today} (${targetPlan.title})`,
              createdBy: toUuidOrNull(actorUserId),
            });
          }
        }
      }

      // Record audit log
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'payment.desk_sale',
        entityType: 'payment',
        entityId: payment.id,
        payload: {
          invoiceNumber,
          totalMinor: payment.totalMinor,
          method: payment.method,
          purpose: payment.purpose,
          memberId: payment.memberId,
        },
      });

      return {
        payment,
        invoice,
      };
    });
  }

  /**
   * Get payment details and attached invoice
   */
  async getPaymentById(gymId: string, paymentId: string) {
    const payment = await this.db.query.payments.findFirst({
      where: scopeEntityToGym(payments, gymId, paymentId),
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Payment not found',
      });
    }

    const invoice = await this.db.query.invoices.findFirst({
      where: scopeToGym(invoices, gymId, eq(invoices.paymentId, paymentId)),
    });

    return {
      ...payment,
      invoice: invoice ?? null,
    };
  }

  /**
   * Void a payment (Manager or Owner only, with mandatory reason)
   */
  async voidPayment(
    gymId: string,
    paymentId: string,
    rawInput: unknown,
    actorUserId?: string,
  ) {
    const parseResult = voidPaymentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid void payment data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: VoidPaymentInput = parseResult.data;

    const payment = await this.db.query.payments.findFirst({
      where: scopeEntityToGym(payments, gymId, paymentId),
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Payment not found',
      });
    }

    if (payment.status === 'voided') {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'This payment has already been voided',
      });
    }

    const [voided] = await this.db
      .update(payments)
      .set({
        status: 'voided',
        voidReason: input.reason,
      })
      .where(scopeEntityToGym(payments, gymId, paymentId))
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'payment.void',
      entityType: 'payment',
      entityId: paymentId,
      payload: {
        totalMinor: payment.totalMinor,
        reason: input.reason,
      },
    });

    return voided;
  }
}
