import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import { branches, gyms } from '../db/schema';
import { createBranchSchema, type CreateBranchInput } from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';

@Injectable()
export class BranchesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Create a new branch for the current gym (enforced tenant scoping + verification limit + audit trail)
   */
  async createBranch(gymId: string, rawInput: unknown, actorUserId?: string) {
    const parseResult = createBranchSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid branch creation data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: PropertyKey[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: CreateBranchInput = parseResult.data;

    // 1. Verify gym status and enforce approval
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    if (gym.status !== 'active' && gym.status !== 'pending_verification') {
      throw new ForbiddenException({
        code: 'GYM_NOT_ACTIVE',
        message: 'Gym must be active or in verification review to provision branches',
      });
    }

    // 2. Enforce SaaS platform subscription tier branch limits
    await this.subscriptionsService.checkBranchLimit(gymId);

    const [newBranch] = await this.db
      .insert(branches)
      .values({
        gymId,
        name: input.name,
        address: input.address ?? {},
        isActive: input.isActive ?? true,
      })
      .returning();

    // Record immutable audit entry
    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'branch.create',
      entityType: 'branch',
      entityId: newBranch.id,
      payload: { name: newBranch.name, address: newBranch.address },
    });

    return newBranch;
  }

  /**
   * List all branches for the active gym (enforced tenant scoping)
   */
  async getGymBranches(gymId: string) {
    return await this.db.query.branches.findMany({
      where: scopeToGym(branches, gymId),
    });
  }

  /**
   * Get a single branch details (strictly scoped by gymId AND branchId)
   */
  async getBranchById(gymId: string, branchId: string) {
    return await this.db.query.branches.findFirst({
      where: scopeEntityToGym(branches, gymId, branchId),
    });
  }

  /**
   * Update an existing branch (name, address, isActive) with tenant scoping & audit trail
   */
  async updateBranch(gymId: string, branchId: string, rawInput: unknown, actorUserId?: string) {
    const branch = await this.getBranchById(gymId, branchId);
    if (!branch) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Branch not found',
      });
    }

    const input = rawInput as Partial<CreateBranchInput>;
    const updateData: Record<string, unknown> = {};
    if (typeof input.name === 'string' && input.name.trim().length >= 2) {
      updateData.name = input.name.trim();
    }
    if (input.address && typeof input.address === 'object') {
      updateData.address = {
        ...(branch.address as Record<string, unknown>),
        ...input.address,
      };
    }
    if (typeof input.isActive === 'boolean') {
      updateData.isActive = input.isActive;
    }

    const [updated] = await this.db
      .update(branches)
      .set(updateData)
      .where(scopeEntityToGym(branches, gymId, branchId))
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'branch.update',
      entityType: 'branch',
      entityId: branchId,
      payload: updateData,
    });

    return updated;
  }
}

