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
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';

@Injectable()
export class BranchesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
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
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: CreateBranchInput = parseResult.data;

    // 1. Verify gym status and enforce approval/branch limit
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    if (gym.status !== 'active') {
      throw new ForbiddenException({
        code: 'GYM_NOT_ACTIVE',
        message: 'Gym must be active to create a new branch',
      });
    }

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
}
