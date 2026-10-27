import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import { freezePolicies, gyms, plans } from '../db/schema';
import {
  createPlanSchema,
  type CreatePlanInput,
  updatePlanSchema,
  type UpdatePlanInput,
  freezePolicySchema,
  type FreezePolicyInput,
} from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';

@Injectable()
export class PlansService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new membership plan for the gym
   * Enforced tenant scoping + audit trail
   */
  async createPlan(gymId: string, rawInput: unknown, actorUserId?: string) {
    const parseResult = createPlanSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid plan data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: CreatePlanInput = parseResult.data;

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    const currency = input.currency || gym?.currency || 'AED';

    const [newPlan] = await this.db
      .insert(plans)
      .values({
        gymId,
        title: input.title,
        durationUnit: input.durationUnit,
        durationValue: input.durationValue,
        priceMinor: Number(input.priceMinor),
        currency,
        priceIncludesVat: input.priceIncludesVat ?? true,
        graceDays: input.graceDays ?? 0,
        branchAccess: input.branchAccess ?? 'home_only',
        accessSchedule: input.accessSchedule ?? null,
        isActive: input.isActive ?? true,
      })
      .returning();

    // Record audit log
    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'plan.create',
      entityType: 'plan',
      entityId: newPlan.id,
      payload: {
        title: newPlan.title,
        duration: `${newPlan.durationValue} ${newPlan.durationUnit}(s)`,
        priceMinor: newPlan.priceMinor,
      },
    });

    return newPlan;
  }

  /**
   * List plans for current gym
   */
  async getGymPlans(gymId: string, includeInactive = false) {
    return await this.db.query.plans.findMany({
      where: scopeToGym(plans, gymId, !includeInactive ? eq(plans.isActive, true) : undefined),
      orderBy: [desc(plans.id)],
    });
  }

  /**
   * Get single plan with its freeze policy
   */
  async getPlanById(gymId: string, planId: string) {
    const plan = await this.db.query.plans.findFirst({
      where: scopeEntityToGym(plans, gymId, planId),
    });

    if (!plan) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Plan not found',
      });
    }

    // Get specific or gym default freeze policy using tenant helper
    const policy = await this.db.query.freezePolicies.findFirst({
      where: scopeToGym(
        freezePolicies,
        gymId,
        or(
          eq(freezePolicies.planId, planId),
          isNull(freezePolicies.planId),
        ),
      ),
    });

    return {
      ...plan,
      freezePolicy: policy ?? null,
    };
  }

  /**
   * Update plan fields or active status
   */
  async updatePlan(
    gymId: string,
    planId: string,
    rawInput: unknown,
    actorUserId?: string,
  ) {
    const parseResult = updatePlanSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid plan update data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const existing = await this.db.query.plans.findFirst({
      where: scopeEntityToGym(plans, gymId, planId),
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Plan not found',
      });
    }

    const input: UpdatePlanInput = parseResult.data;

    const [updated] = await this.db
      .update(plans)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.durationUnit !== undefined ? { durationUnit: input.durationUnit } : {}),
        ...(input.durationValue !== undefined ? { durationValue: input.durationValue } : {}),
        ...(input.priceMinor !== undefined ? { priceMinor: Number(input.priceMinor) } : {}),
        ...(input.priceIncludesVat !== undefined
          ? { priceIncludesVat: input.priceIncludesVat }
          : {}),
        ...(input.graceDays !== undefined ? { graceDays: input.graceDays } : {}),
        ...(input.branchAccess !== undefined ? { branchAccess: input.branchAccess } : {}),
        ...(input.accessSchedule !== undefined ? { accessSchedule: input.accessSchedule } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(scopeEntityToGym(plans, gymId, planId))
      .returning();

    // Audit log
    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'plan.update',
      entityType: 'plan',
      entityId: planId,
      payload: {
        updatedFields: Object.keys(input),
      },
    });

    return updated;
  }

  /**
   * Configure a freeze policy for a specific plan or as gym master default
   */
  async configureFreezePolicy(
    gymId: string,
    rawInput: unknown,
    actorUserId?: string,
  ) {
    const parseResult = freezePolicySchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid freeze policy data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: FreezePolicyInput = parseResult.data;

    if (input.planId) {
      const plan = await this.db.query.plans.findFirst({
        where: scopeEntityToGym(plans, gymId, input.planId),
      });
      if (!plan) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Specified planId is invalid or belongs to another gym',
        });
      }
    }

    // Upsert freeze policy
    const existing = await this.db.query.freezePolicies.findFirst({
      where: input.planId
        ? eq(freezePolicies.planId, input.planId)
        : and(eq(freezePolicies.gymId, gymId), isNull(freezePolicies.planId)),
    });

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const currency = input.currency || gym?.currency || 'AED';

    let policy;
    if (existing) {
      const [updated] = await this.db
        .update(freezePolicies)
        .set({
          isEnabled: input.isEnabled,
          maxOccurrences: input.maxOccurrences,
          minDays: input.minDays,
          maxTotalDays: input.maxTotalDays,
          noticeDays: input.noticeDays,
          proofMode: input.proofMode,
          requireReview: input.requireReview,
          cycleBasis: input.cycleBasis,
          allowRemainingBalance: input.allowRemainingBalance,
          feeMinor: Number(input.feeMinor ?? 0n),
          currency,
        })
        .where(scopeEntityToGym(freezePolicies, gymId, existing.id))
        .returning();
      policy = updated;
    } else {
      const [created] = await this.db
        .insert(freezePolicies)
        .values({
          gymId,
          planId: input.planId ?? null,
          isEnabled: input.isEnabled,
          maxOccurrences: input.maxOccurrences,
          minDays: input.minDays,
          maxTotalDays: input.maxTotalDays,
          noticeDays: input.noticeDays,
          proofMode: input.proofMode,
          requireReview: input.requireReview,
          cycleBasis: input.cycleBasis,
          allowRemainingBalance: input.allowRemainingBalance,
          feeMinor: Number(input.feeMinor ?? 0n),
          currency,
        })
        .returning();
      policy = created;
    }

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'freeze_policy.configure',
      entityType: 'freeze_policy',
      entityId: policy.id,
      payload: {
        planId: input.planId ?? 'default',
        maxOccurrences: policy.maxOccurrences,
        maxTotalDays: policy.maxTotalDays,
      },
    });

    return policy;
  }
}
