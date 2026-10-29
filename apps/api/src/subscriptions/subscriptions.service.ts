import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
  branches,
  gyms,
  gymSubscriptions,
  members,
  platformInvoiceCounters,
  platformInvoices,
  platformInvoicePayments,
  saasPlans,
  users,
} from '../db/schema';
import { AuditService } from '../common/audit/audit.service';
import { addDays, formatDateOnly } from '@gympulse/shared';
import { getGymLocalDate } from '../common/utils/dates';
import {
  createSaasPlanSchema,
  provisionSubscriptionSchema,
  recordPlatformPaymentSchema,
  changeSubscriptionSchema,
  type CreateSaasPlanDto,
  type ProvisionSubscriptionDto,
  type RecordPlatformPaymentDto,
  type ChangeSubscriptionDto,
} from './subscriptions.types';

const PLATFORM_SUPPLIER = {
  name: 'GymPulse Technologies FZ-LLC',
  trn: '100987654300003',
  address: 'Dubai Internet City, Building 12, Office 304, Dubai, UAE',
};

export const MEMBER_LIMIT_UNSUBSCRIBED = 10;

@Injectable()
export class SubscriptionsService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPlans();
  }

  /**
   * Seed standard GymPulse SaaS plans if table is empty
   */
  async seedDefaultPlans() {
    const existing = await this.db.query.saasPlans.findFirst();
    if (existing) return;

    const defaultPlans = [
      {
        code: 'starter',
        name: 'Starter Tier',
        billingInterval: 'month' as const,
        priceMinor: 39900, // 399 AED
        currency: 'AED',
        limits: { maxBranches: 1, maxMembers: 150, maxStaff: 5 },
        isActive: true,
      },
      {
        code: 'growth',
        name: 'Growth Tier',
        billingInterval: 'month' as const,
        priceMinor: 79900, // 799 AED
        currency: 'AED',
        limits: { maxBranches: 3, maxMembers: 500, maxStaff: 15 },
        isActive: true,
      },
      {
        code: 'enterprise',
        name: 'Enterprise Tier',
        billingInterval: 'month' as const,
        priceMinor: 149900, // 1499 AED
        currency: 'AED',
        limits: { maxBranches: 10, maxMembers: 2000, maxStaff: 50 },
        isActive: true,
      },
    ];

    for (const plan of defaultPlans) {
      await this.db
        .insert(saasPlans)
        .values(plan)
        .onConflictDoNothing({ target: saasPlans.code });
    }
  }

  /**
   * List all available SaaS pricing tiers
   */
  async listPlans() {
    return this.db.query.saasPlans.findMany({
      where: eq(saasPlans.isActive, true),
      orderBy: [saasPlans.priceMinor],
    });
  }

  /**
   * Create a new SaaS plan tier (Platform superadmin)
   */
  async createPlan(rawInput: unknown, actorAdminId?: string) {
    const parseResult = createSaasPlanSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid SaaS plan data',
        invalidParams: parseResult.error.issues.map((i: { name: string; reason: string }) => ({
          name: i.name,
          reason: i.reason,
        })),
      });
    }

    const input: CreateSaasPlanDto = parseResult.data;

    const [existing] = await this.db
      .select({ id: saasPlans.id })
      .from(saasPlans)
      .where(eq(saasPlans.code, input.code))
      .limit(1);

    if (existing) {
      throw new ConflictException({
        code: 'PLAN_CODE_EXISTS',
        message: `Plan with code '${input.code}' already exists`,
      });
    }

    const [created] = await this.db
      .insert(saasPlans)
      .values(input)
      .returning();

    await this.auditService.log({
      action: 'PLATFORM_SAAS_PLAN_CREATED',
      entityType: 'saas_plan',
      entityId: created.id,
      adminActorId: actorAdminId,
      payload: { code: created.code, priceMinor: created.priceMinor, limits: created.limits },
    });

    return created;
  }

  /**
   * Get current gym subscription, usage, tier limits, and dunning status
   */
  async getGymSubscription(gymId: string) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    if (!gym) {
      throw new NotFoundException({ code: 'GYM_NOT_FOUND', message: 'Gym not found' });
    }

    const sub = await this.db.query.gymSubscriptions.findFirst({
      where: eq(gymSubscriptions.gymId, gymId),
      orderBy: [desc(gymSubscriptions.createdAt)],
    });

    let plan = null;
    if (sub) {
      plan = await this.db.query.saasPlans.findFirst({
        where: eq(saasPlans.id, sub.saasPlanId),
      });
    }

    const [memberCountRes] = await this.db
      .select({ count: count(members.id) })
      .from(members)
      .where(and(eq(members.gymId, gymId), eq(members.status, 'active')));

    const [branchCountRes] = await this.db
      .select({ count: count(branches.id) })
      .from(branches)
      .where(and(eq(branches.gymId, gymId), eq(branches.isActive, true)));

    const activeMembers = Number(memberCountRes?.count ?? 0);
    const activeBranches = Number(branchCountRes?.count ?? 0);

    const hasActiveSubscription =
      !!sub && ['trialing', 'active', 'past_due', 'restricted'].includes(sub.status);

    const isRestricted = sub?.status === 'restricted';
    const isSuspended = sub?.status === 'suspended';

    const limits = plan?.limits ?? {
      maxBranches: 1,
      maxMembers: MEMBER_LIMIT_UNSUBSCRIBED,
      maxStaff: 5,
    };

    return {
      subscription: sub ?? null,
      plan: plan ?? null,
      hasActiveSubscription,
      isRestricted,
      isSuspended,
      usage: {
        activeMembers,
        activeBranches,
      },
      limits,
      unsubscribedCap: MEMBER_LIMIT_UNSUBSCRIBED,
    };
  }

  /**
   * Provision or assign a SaaS plan to a gym with atomic gapless invoice generation
   */
  async provisionSubscription(rawInput: unknown, actorAdminId?: string) {
    const parseResult = provisionSubscriptionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid subscription provisioning payload',
        invalidParams: parseResult.error.issues.map((i: { name: string; reason: string }) => ({
          name: i.name,
          reason: i.reason,
        })),
      });
    }

    const input: ProvisionSubscriptionDto = parseResult.data;

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, input.gymId),
    });
    if (!gym) {
      throw new NotFoundException({ code: 'GYM_NOT_FOUND', message: 'Gym not found' });
    }

    const plan = await this.db.query.saasPlans.findFirst({
      where: and(eq(saasPlans.id, input.saasPlanId), eq(saasPlans.isActive, true)),
    });
    if (!plan) {
      throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'SaaS plan not found or inactive' });
    }

    const todayStr = input.startDate || getGymLocalDate(gym.timezone || 'Asia/Dubai');
    const termDays = plan.billingInterval === 'year' ? 365 : input.termMonths * 30;
    const periodEndStr = addDays(todayStr, termDays);
    const dueOnStr = addDays(todayStr, input.dueDays);

    return await this.db.transaction(async (tx) => {
      // 1. Create or update gym subscription
      const [subscription] = await tx
        .insert(gymSubscriptions)
        .values({
          gymId: gym.id,
          saasPlanId: plan.id,
          status: 'active',
          periodStart: todayStr,
          periodEnd: periodEndStr,
          billingMethod: input.billingMethod,
        })
        .returning();

      // 2. Atomic sequential platform tax invoice numbering
      const counterSeries = 'GP-INV';
      const seqResult = await tx.execute(sql`
        INSERT INTO platform_invoice_counters (series, next_number)
        VALUES (${counterSeries}, 2)
        ON CONFLICT (series) DO UPDATE
        SET next_number = platform_invoice_counters.next_number + 1
        RETURNING next_number - 1 AS assigned_number
      `);

      const rawNumber = Number(
        (seqResult.rows[0] as { assigned_number: number | string }).assigned_number,
      );
      const invoiceNumber = `${counterSeries}-${String(rawNumber).padStart(6, '0')}`;

      // 3. 5% UAE VAT computation
      const subtotalMinor = plan.priceMinor;
      const vatMinor = Math.round(subtotalMinor * 0.05);
      const grandTotalMinor = subtotalMinor + vatMinor;

      const buyer = {
        name: gym.legalName || gym.tradeName,
        trn: gym.trnNumber || null,
        address: (gym.settings as Record<string, unknown>)?.address ? String((gym.settings as Record<string, unknown>).address) : 'United Arab Emirates',
      };

      const lines = [
        {
          description: `GymPulse SaaS Platform Subscription - ${plan.name} (${plan.billingInterval})`,
          quantity: 1,
          unitPriceMinor: subtotalMinor,
          vatRatePercent: 5,
          vatMinor,
          totalMinor: grandTotalMinor,
        },
      ];

      const totals = {
        subtotalMinor,
        vatMinor,
        grandTotalMinor,
        currency: plan.currency,
      };

      const [invoice] = await tx
        .insert(platformInvoices)
        .values({
          gymId: gym.id,
          subscriptionId: subscription.id,
          docType: 'tax_invoice',
          series: counterSeries,
          number: rawNumber,
          invoiceNumber,
          issuedOn: todayStr,
          dueOn: dueOnStr,
          supplier: PLATFORM_SUPPLIER,
          buyer,
          lines,
          totals,
        })
        .returning();

      await this.auditService.log({
        gymId: gym.id,
        action: 'PLATFORM_SUBSCRIPTION_PROVISIONED',
        entityType: 'gym_subscription',
        entityId: subscription.id,
        adminActorId: actorAdminId,
        payload: {
          planId: plan.id,
          planCode: plan.code,
          periodStart: todayStr,
          periodEnd: periodEndStr,
          invoiceNumber,
          grandTotalMinor,
        },
      });

      return {
        subscription,
        invoice,
        plan,
      };
    });
  }

  /**
   * List platform invoices for a tenant gym
   */
  async getGymInvoices(gymId: string) {
    const invoices = await this.db.query.platformInvoices.findMany({
      where: eq(platformInvoices.gymId, gymId),
      orderBy: [desc(platformInvoices.issuedOn), desc(platformInvoices.number)],
    });

    const result = [];
    for (const inv of invoices) {
      const paymentsList = await this.db.query.platformInvoicePayments.findMany({
        where: eq(platformInvoicePayments.invoiceId, inv.id),
      });
      const totalPaid = paymentsList.reduce((acc, p) => acc + Number(p.amountMinor), 0);
      const grandTotal = Number((inv.totals as { grandTotalMinor?: number })?.grandTotalMinor ?? 0);
      const isPaid = totalPaid >= grandTotal;

      result.push({
        ...inv,
        payments: paymentsList,
        totalPaidMinor: totalPaid,
        balanceDueMinor: Math.max(0, grandTotal - totalPaid),
        isPaid,
      });
    }

    return result;
  }

  /**
   * List all platform invoices (Platform admin)
   */
  async getPlatformInvoices(query: { gymId?: string; isPaid?: boolean }) {
    const whereConditions = [];
    if (query.gymId) {
      whereConditions.push(eq(platformInvoices.gymId, query.gymId));
    }

    const invoices = await this.db.query.platformInvoices.findMany({
      where: whereConditions.length ? and(...whereConditions) : undefined,
      orderBy: [desc(platformInvoices.issuedOn), desc(platformInvoices.number)],
    });

    const result = [];
    for (const inv of invoices) {
      const paymentsList = await this.db.query.platformInvoicePayments.findMany({
        where: eq(platformInvoicePayments.invoiceId, inv.id),
      });
      const totalPaid = paymentsList.reduce((acc, p) => acc + Number(p.amountMinor), 0);
      const grandTotal = Number((inv.totals as { grandTotalMinor?: number })?.grandTotalMinor ?? 0);
      const isPaid = totalPaid >= grandTotal;

      if (query.isPaid !== undefined && isPaid !== query.isPaid) {
        continue;
      }

      const gym = await this.db.query.gyms.findFirst({
        where: eq(gyms.id, inv.gymId),
        columns: { id: true, name: true, legalName: true },
      });

      result.push({
        ...inv,
        gym,
        payments: paymentsList,
        totalPaidMinor: totalPaid,
        balanceDueMinor: Math.max(0, grandTotal - totalPaid),
        isPaid,
      });
    }

    return result;
  }

  /**
   * Record payment for a platform invoice and immediately lift dunning restrictions
   */
  async recordInvoicePayment(
    invoiceId: string,
    rawInput: unknown,
    recordedByUserId?: string,
  ) {
    const parseResult = recordPlatformPaymentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid platform payment data',
        invalidParams: parseResult.error.issues.map((i: { name: string; reason: string }) => ({
          name: i.name,
          reason: i.reason,
        })),
      });
    }

    const input: RecordPlatformPaymentDto = parseResult.data;

    const invoice = await this.db.query.platformInvoices.findFirst({
      where: eq(platformInvoices.id, invoiceId),
    });
    if (!invoice) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'Platform invoice not found',
      });
    }

    return await this.db.transaction(async (tx) => {
      // 1. Insert payment record
      let validRecordedBy: string | null = null;
      if (recordedByUserId) {
        const u = await tx.query.users.findFirst({
          where: eq(users.id, recordedByUserId),
        });
        if (u) {
          validRecordedBy = u.id;
        }
      }

      const [payment] = await tx
        .insert(platformInvoicePayments)
        .values({
          invoiceId: invoice.id,
          method: input.method,
          amountMinor: input.amountMinor,
          reference: input.reference || null,
          receivedOn: input.receivedOn,
          recordedBy: validRecordedBy,
        })
        .returning();

      // 2. Sum all payments for this invoice
      const paymentsList = await tx.query.platformInvoicePayments.findMany({
        where: eq(platformInvoicePayments.invoiceId, invoice.id),
      });
      const totalPaid = paymentsList.reduce((acc, p) => acc + Number(p.amountMinor), 0);
      const grandTotal = Number(
        (invoice.totals as { grandTotalMinor?: number })?.grandTotalMinor ?? 0,
      );
      const isPaid = totalPaid >= grandTotal;

      // 3. If paid in full, restore subscription to active and lift restrictions immediately!
      let restrictionLifted = false;
      const sub = await tx.query.gymSubscriptions.findFirst({
        where: eq(gymSubscriptions.id, invoice.subscriptionId),
      });

      if (isPaid && sub && ['past_due', 'restricted', 'suspended'].includes(sub.status)) {
        await tx
          .update(gymSubscriptions)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(gymSubscriptions.id, sub.id));

        restrictionLifted = true;

        await this.auditService.log({
          gymId: invoice.gymId,
          action: 'SUBSCRIPTION_RESTRICTIONS_LIFTED',
          entityType: 'gym_subscription',
          entityId: sub.id,
          actorUserId: recordedByUserId,
          payload: {
            previousStatus: sub.status,
            newStatus: 'active',
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            totalPaidMinor: totalPaid,
          },
        });
      }

      await this.auditService.log({
        gymId: invoice.gymId,
        action: 'PLATFORM_INVOICE_PAYMENT_RECORDED',
        entityType: 'platform_invoice_payment',
        entityId: payment.id,
        actorUserId: recordedByUserId,
        payload: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountMinor: input.amountMinor,
          isPaid,
          restrictionLifted,
        },
      });

      return {
        payment,
        invoiceNumber: invoice.invoiceNumber,
        totalPaidMinor: totalPaid,
        balanceDueMinor: Math.max(0, grandTotal - totalPaid),
        isPaid,
        restrictionLifted,
      };
    });
  }

  /**
   * Run dunning engine sweep across all gym subscriptions
   * Evaluates:
   * - Renewal invoices (-14 days from periodEnd)
   * - Grace period / past_due (due date passed unpaid)
   * - Restricted (+14 days past due: member signup, payment links, freezes blocked)
   * - Suspended (+30 days past due: check-in blocked)
   */
  async runSubscriptionSweep(asOfDate?: string) {
    const sweepDate = asOfDate || getGymLocalDate('Asia/Dubai');

    const subscriptions = await this.db.query.gymSubscriptions.findMany({
      where: inArray(gymSubscriptions.status, [
        'trialing',
        'active',
        'past_due',
        'restricted',
        'suspended',
      ]),
    });

    let pastDueCount = 0;
    let restrictedCount = 0;
    let suspendedCount = 0;
    let activeRestoredCount = 0;
    let renewalInvoicesIssued = 0;

    for (const sub of subscriptions) {
      // 1. Issue Renewal Invoice 14 days before periodEnd
      const renewalNoticeDate = addDays(sub.periodEnd, -14);
      if (sweepDate >= renewalNoticeDate) {
        // Check if an invoice for the renewal period already exists
        const existingNextInvoice = await this.db.query.platformInvoices.findFirst({
          where: and(
            eq(platformInvoices.gymId, sub.gymId),
            eq(platformInvoices.issuedOn, sub.periodEnd),
          ),
        });

        if (!existingNextInvoice) {
          const plan = await this.db.query.saasPlans.findFirst({
            where: eq(saasPlans.id, sub.saasPlanId),
          });
          const gym = await this.db.query.gyms.findFirst({
            where: eq(gyms.id, sub.gymId),
          });

          if (plan && gym) {
            const counterSeries = 'GP-INV';
            const seqResult = await this.db.execute(sql`
              INSERT INTO platform_invoice_counters (series, next_number)
              VALUES (${counterSeries}, 2)
              ON CONFLICT (series) DO UPDATE
              SET next_number = platform_invoice_counters.next_number + 1
              RETURNING next_number - 1 AS assigned_number
            `);
            const rawNumber = Number(
              (seqResult.rows[0] as { assigned_number: number | string }).assigned_number,
            );
            const invoiceNumber = `${counterSeries}-${String(rawNumber).padStart(6, '0')}`;

            const subtotalMinor = plan.priceMinor;
            const vatMinor = Math.round(subtotalMinor * 0.05);
            const grandTotalMinor = subtotalMinor + vatMinor;

            await this.db.insert(platformInvoices).values({
              gymId: sub.gymId,
              subscriptionId: sub.id,
              docType: 'tax_invoice',
              series: counterSeries,
              number: rawNumber,
              invoiceNumber,
              issuedOn: sub.periodEnd,
              dueOn: addDays(sub.periodEnd, 14),
              supplier: PLATFORM_SUPPLIER,
              buyer: {
                name: gym.legalName || gym.tradeName,
                trn: gym.trnNumber || null,
                address: (gym.settings as Record<string, unknown>)?.address ? String((gym.settings as Record<string, unknown>).address) : 'United Arab Emirates',
              },
              lines: [
                {
                  description: `GymPulse SaaS Platform Subscription Renewal - ${plan.name}`,
                  quantity: 1,
                  unitPriceMinor: subtotalMinor,
                  vatRatePercent: 5,
                  vatMinor,
                  totalMinor: grandTotalMinor,
                },
              ],
              totals: {
                subtotalMinor,
                vatMinor,
                grandTotalMinor,
                currency: plan.currency,
              },
            });

            renewalInvoicesIssued++;
          }
        }
      }

      // 2. Evaluate Overdue Invoices
      const invoices = await this.db.query.platformInvoices.findMany({
        where: eq(platformInvoices.gymId, sub.gymId),
        orderBy: [platformInvoices.dueOn],
      });

      let oldestOverdueDays = -1;

      for (const inv of invoices) {
        const paymentsList = await this.db.query.platformInvoicePayments.findMany({
          where: eq(platformInvoicePayments.invoiceId, inv.id),
        });
        const totalPaid = paymentsList.reduce((acc, p) => acc + Number(p.amountMinor), 0);
        const grandTotal = Number(
          (inv.totals as { grandTotalMinor?: number })?.grandTotalMinor ?? 0,
        );

        if (totalPaid < grandTotal) {
          // Unpaid invoice
          const dueTimestamp = new Date(`${inv.dueOn}T00:00:00Z`).getTime();
          const sweepTimestamp = new Date(`${sweepDate}T00:00:00Z`).getTime();
          const diffDays = Math.floor((sweepTimestamp - dueTimestamp) / (1000 * 60 * 60 * 24));

          if (diffDays > 0 && diffDays > oldestOverdueDays) {
            oldestOverdueDays = diffDays;
          }
        }
      }

      // 3. Apply state machine transitions
      if (oldestOverdueDays >= 30) {
        if (sub.status !== 'suspended') {
          await this.db
            .update(gymSubscriptions)
            .set({ status: 'suspended', updatedAt: new Date() })
            .where(eq(gymSubscriptions.id, sub.id));
          suspendedCount++;
        }
      } else if (oldestOverdueDays >= 14) {
        if (sub.status !== 'restricted') {
          await this.db
            .update(gymSubscriptions)
            .set({ status: 'restricted', updatedAt: new Date() })
            .where(eq(gymSubscriptions.id, sub.id));
          restrictedCount++;
        }
      } else if (oldestOverdueDays > 0) {
        if (sub.status !== 'past_due' && sub.status !== 'restricted' && sub.status !== 'suspended') {
          await this.db
            .update(gymSubscriptions)
            .set({ status: 'past_due', updatedAt: new Date() })
            .where(eq(gymSubscriptions.id, sub.id));
          pastDueCount++;
        }
      } else if (oldestOverdueDays === -1 && ['past_due', 'restricted', 'suspended'].includes(sub.status)) {
        // No overdue invoices left; restore active
        await this.db
          .update(gymSubscriptions)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(gymSubscriptions.id, sub.id));
        activeRestoredCount++;
      }
    }

    return {
      sweepDate,
      totalEvaluated: subscriptions.length,
      pastDueCount,
      restrictedCount,
      suspendedCount,
      activeRestoredCount,
      renewalInvoicesIssued,
    };
  }

  /**
   * Request subscription plan change (Tenant Owner)
   */
  async changeSubscription(gymId: string, rawInput: unknown, actorUserId?: string) {
    const parseResult = changeSubscriptionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid subscription change request',
      });
    }

    const input: ChangeSubscriptionDto = parseResult.data;
    const plan = await this.db.query.saasPlans.findFirst({
      where: and(eq(saasPlans.id, input.saasPlanId), eq(saasPlans.isActive, true)),
    });
    if (!plan) {
      throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Target SaaS plan not found' });
    }

    const currentSub = await this.db.query.gymSubscriptions.findFirst({
      where: eq(gymSubscriptions.gymId, gymId),
      orderBy: [desc(gymSubscriptions.createdAt)],
    });

    if (!currentSub) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found to change. Please contact platform support.',
      });
    }

    const [updated] = await this.db
      .update(gymSubscriptions)
      .set({
        saasPlanId: plan.id,
        billingMethod: input.billingMethod || currentSub.billingMethod,
        updatedAt: new Date(),
      })
      .where(eq(gymSubscriptions.id, currentSub.id))
      .returning();

    await this.auditService.log({
      gymId,
      action: 'SUBSCRIPTION_PLAN_CHANGED',
      entityType: 'gym_subscription',
      entityId: updated.id,
      actorUserId,
      payload: {
        oldPlanId: currentSub.saasPlanId,
        newPlanId: plan.id,
        newPlanCode: plan.code,
      },
    });

    return {
      subscription: updated,
      plan,
    };
  }

  // ==========================================================================
  // Enforcements & Policy Checks
  // ==========================================================================

  /**
   * Check if gym is allowed to add a new member.
   * Enforces:
   * 1. If restricted, throws SUBSCRIPTION_RESTRICTED (403)
   * 2. If unsubscribed (no active/trialing subscription), caps at 10 members (MEMBER_LIMIT_UNSUBSCRIBED)
   * 3. If subscribed, checks plan.limits.maxMembers (MEMBER_LIMIT_EXCEEDED)
   */
  async checkMemberLimit(gymId: string): Promise<void> {
    const subInfo = await this.getGymSubscription(gymId);

    if (subInfo.isRestricted) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_RESTRICTED',
        message: 'Gym subscription is restricted due to overdue platform invoice. Member registration is paused.',
      });
    }

    if (subInfo.isSuspended) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_SUSPENDED',
        message: 'Gym subscription is suspended. Operations are blocked.',
      });
    }

    const memberCount = subInfo.usage.activeMembers;

    if (!subInfo.hasActiveSubscription) {
      if (memberCount >= MEMBER_LIMIT_UNSUBSCRIBED) {
        throw new ForbiddenException({
          code: 'MEMBER_LIMIT_UNSUBSCRIBED',
          message: `Unsubscribed gyms are capped at ${MEMBER_LIMIT_UNSUBSCRIBED} members. Please subscribe to a SaaS plan to register more members.`,
          currentCount: memberCount,
          maxAllowed: MEMBER_LIMIT_UNSUBSCRIBED,
        });
      }
    } else if (subInfo.plan?.limits) {
      const maxAllowed = (subInfo.plan.limits as { maxMembers?: number }).maxMembers ?? 150;
      if (memberCount >= maxAllowed) {
        throw new ForbiddenException({
          code: 'MEMBER_LIMIT_EXCEEDED',
          message: `Current SaaS plan limit of ${maxAllowed} members reached. Please upgrade your subscription.`,
          currentCount: memberCount,
          maxAllowed,
        });
      }
    }
  }

  /**
   * Check if branch creation is allowed under current SaaS plan limits
   */
  async checkBranchLimit(gymId: string): Promise<void> {
    const subInfo = await this.getGymSubscription(gymId);

    if (subInfo.isRestricted) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_RESTRICTED',
        message: 'Gym subscription is restricted due to overdue platform invoice. Branch management is paused.',
      });
    }

    const branchCount = subInfo.usage.activeBranches;
    const maxAllowed = (subInfo.limits as { maxBranches?: number }).maxBranches ?? 1;

    if (branchCount >= maxAllowed) {
      throw new ForbiddenException({
        code: 'BRANCH_LIMIT_EXCEEDED',
        message: `Current SaaS plan limit of ${maxAllowed} branch(es) reached. Please upgrade your subscription.`,
        currentCount: branchCount,
        maxAllowed,
      });
    }
  }

  /**
   * Check if check-in / access is allowed.
   * If gym is suspended, turnstiles and check-in are disabled (403)
   */
  async checkCheckInAllowed(gymId: string): Promise<void> {
    const sub = await this.db.query.gymSubscriptions.findFirst({
      where: eq(gymSubscriptions.gymId, gymId),
      orderBy: [desc(gymSubscriptions.createdAt)],
    });

    if (sub?.status === 'suspended') {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_SUSPENDED',
        message: 'Gym subscription is suspended due to unpaid invoice (+30 days). Access and check-in disabled.',
      });
    }
  }

  /**
   * Check if checkout/payment operations are allowed.
   * Blocked if subscription is restricted or suspended.
   */
  async checkPaymentAllowed(gymId: string): Promise<void> {
    const sub = await this.db.query.gymSubscriptions.findFirst({
      where: eq(gymSubscriptions.gymId, gymId),
      orderBy: [desc(gymSubscriptions.createdAt)],
    });

    if (sub?.status === 'restricted' || sub?.status === 'suspended') {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_RESTRICTED',
        message: 'Gym subscription is restricted or suspended due to overdue invoice. Payment processing is paused.',
      });
    }
  }

  /**
   * Check if freeze operations are allowed.
   * Blocked if subscription is restricted or suspended.
   */
  async checkFreezeAllowed(gymId: string): Promise<void> {
    const sub = await this.db.query.gymSubscriptions.findFirst({
      where: eq(gymSubscriptions.gymId, gymId),
      orderBy: [desc(gymSubscriptions.createdAt)],
    });

    if (sub?.status === 'restricted' || sub?.status === 'suspended') {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_RESTRICTED',
        message: 'Gym subscription is restricted or suspended due to overdue invoice. Freezes are paused.',
      });
    }
  }
}
