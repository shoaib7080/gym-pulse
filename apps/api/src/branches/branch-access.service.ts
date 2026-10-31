import {
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import { scopeToGym } from '../common/tenant/tenant-scope.helper';
import { branches, staffAssignments, staffBranchAccess } from '../db/schema';

@Injectable()
export class BranchAccessService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Asserts whether a tenant staff member is permitted to operate on a target branch.
   * - 'owner' and 'manager' roles always have gym-wide access across all branches.
   * - If branchScope is 'all', access is granted across all branches in the gym.
   * - If branchScope is 'selected', verifies the staff member is explicitly mapped to branchId in staff_branch_access.
   * Throws ForbiddenException(403) with code 'BRANCH_ACCESS_DENIED' on failure.
   */
  async assertBranchAccess(params: {
    gymId: string;
    userId: string;
    role: string;
    branchScope: 'all' | 'selected';
    branchId: string;
  }): Promise<void> {
    const { gymId, userId, role, branchScope, branchId } = params;

    // First ensure the branch actually belongs to this gym
    const branch = await this.db.query.branches.findFirst({
      where: scopeToGym(branches, gymId, eq(branches.id, branchId)),
    });

    if (!branch) {
      throw new ForbiddenException({
        code: 'BRANCH_NOT_FOUND',
        message: 'The requested branch does not exist in this gym',
      });
    }

    // Owners and Managers have universal gym-wide branch access
    if (role === 'owner' || role === 'manager') {
      return;
    }

    // If assigned branch scope is 'all', access is permitted
    if (branchScope === 'all') {
      return;
    }

    // Staff member has 'selected' scope - verify explicit assignment
    const assignment = await this.db.query.staffAssignments.findFirst({
      where: scopeToGym(
        staffAssignments,
        gymId,
        and(
          eq(staffAssignments.userId, userId),
          eq(staffAssignments.isActive, true),
        ),
      ),
    });

    if (!assignment) {
      throw new ForbiddenException({
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Active staff assignment not found for this gym',
      });
    }

    const hasAccess = await this.db.query.staffBranchAccess.findFirst({
      where: scopeToGym(
        staffBranchAccess,
        gymId,
        and(
          eq(staffBranchAccess.staffAssignmentId, assignment.id),
          eq(staffBranchAccess.branchId, branchId),
        ),
      ),
    });

    if (!hasAccess) {
      throw new ForbiddenException({
        code: 'BRANCH_ACCESS_DENIED',
        message: `You do not have authorization to access branch '${branchId}'`,
      });
    }
  }

  /**
   * Retrieves list of allowed branch IDs for a user, or 'all'.
   */
  async getAllowedBranchIds(params: {
    gymId: string;
    userId: string;
    role: string;
    branchScope: 'all' | 'selected';
  }): Promise<string[] | 'all'> {
    const { gymId, userId, role, branchScope } = params;

    if (role === 'owner' || role === 'manager' || branchScope === 'all') {
      return 'all';
    }

    const assignment = await this.db.query.staffAssignments.findFirst({
      where: scopeToGym(
        staffAssignments,
        gymId,
        and(
          eq(staffAssignments.userId, userId),
          eq(staffAssignments.isActive, true),
        ),
      ),
    });

    if (!assignment) {
      return [];
    }

    const accessRecords = await this.db.query.staffBranchAccess.findMany({
      where: scopeToGym(
        staffBranchAccess,
        gymId,
        eq(staffBranchAccess.staffAssignmentId, assignment.id),
      ),
    });

    return accessRecords.map((r) => r.branchId);
  }
}
