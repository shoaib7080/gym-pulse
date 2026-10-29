import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DB, type Database } from '../db/db.module';
import { authUsers, branches, members, memberships, users } from '../db/schema';
import {
  createMemberSchema,
  type CreateMemberInput,
  updateMemberSchema,
  type UpdateMemberInput,
} from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class MembersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Register a new member in the current gym
   * Enforces:
   * 1. Unique phone/email per gym member
   * 2. Auto-generated sequential member number per gym (e.g. MEM-0001)
   * 3. Tenant-scoped home branch validation
   * 4. Audit trail logging
   * 5. SaaS subscription tier limits & unsubscribed cap (10 members)
   */
  async createMember(gymId: string, rawInput: unknown, actorUserId?: string) {
    // Enforce SaaS plan tier and unsubscribed member cap
    await this.subscriptionsService.checkMemberLimit(gymId);

    const parseResult = createMemberSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid member registration data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: CreateMemberInput = parseResult.data;

    // 1. Verify home branch belongs to this gym if provided
    if (input.homeBranchId) {
      const branch = await this.db.query.branches.findFirst({
        where: scopeEntityToGym(branches, gymId, input.homeBranchId),
      });
      if (!branch) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Specified homeBranchId is invalid or belongs to another gym',
        });
      }
    }

    return await this.db.transaction(async (tx) => {
      // 2. Resolve or provision base user identity
      let user = await tx.query.users.findFirst({
        where: eq(users.phone, input.phone),
      });

      if (!user && input.email) {
        user = await tx.query.users.findFirst({
          where: eq(users.email, input.email.toLowerCase().trim()),
        });
      }

      if (!user) {
        const [newUser] = await tx
          .insert(users)
          .values({
            authUserId: null,
            phone: input.phone,
            email: input.email ? input.email.toLowerCase().trim() : null,
            fullName: input.fullName,
            nameSearch: input.fullName.toLowerCase(),
            status: 'active',
          })
          .returning();

        user = newUser;
      }

      // 3. Ensure user is not already registered in this gym
      const existingGymMember = await tx.query.members.findFirst({
        where: scopeToGym(members, gymId, eq(members.userId, user.id)),
      });

      if (existingGymMember) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `This person (${input.phone}) is already registered as a member in this gym (Member #${existingGymMember.memberNumber})`,
        });
      }

      // 4. Generate or validate member number (strictly unique per gym)
      let finalMemberNumber = input.memberNumber?.trim();

      if (finalMemberNumber) {
        const existingNum = await tx.query.members.findFirst({
          where: scopeToGym(
            members,
            gymId,
            eq(members.memberNumber, finalMemberNumber),
          ),
        });
        if (existingNum) {
          throw new ConflictException({
            code: 'CONFLICT',
            message: `Member number '${finalMemberNumber}' is already in use in this gym`,
          });
        }
      } else {
        // Auto-sequence MEM-0001, MEM-0002...
        const [countResult] = await tx
          .select({ total: count(members.id) })
          .from(members)
          .where(scopeToGym(members, gymId));

        let nextSeq = Number(countResult?.total || 0) + 1;
        while (true) {
          const candidate = `MEM-${String(nextSeq).padStart(4, '0')}`;
          const taken = await tx.query.members.findFirst({
            where: scopeToGym(members, gymId, eq(members.memberNumber, candidate)),
          });
          if (!taken) {
            finalMemberNumber = candidate;
            break;
          }
          nextSeq++;
        }
      }

      // 5. Insert member row
      const [newMember] = await tx
        .insert(members)
        .values({
          gymId,
          userId: user.id,
          memberNumber: finalMemberNumber,
          homeBranchId: input.homeBranchId ?? null,
          gender: input.gender ?? null,
          dateOfBirth: input.dateOfBirth ?? null,
          emergencyContact: input.emergencyContact ?? {},
          status: 'active',
        })
        .returning();

      // 6. Record audit entry
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'member.create',
        entityType: 'member',
        entityId: newMember.id,
        payload: {
          memberNumber: newMember.memberNumber,
          fullName: user.fullName,
          phone: user.phone,
        },
      });

      return {
        ...newMember,
        user: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
        },
      };
    });
  }

  /**
   * List members for current gym with pagination, branch filter, and search
   * Enforced tenant scoping.
   */
  async getMembers(
    gymId: string,
    query: {
      search?: string;
      branchId?: string;
      status?: 'active' | 'archived';
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(members.gymId, gymId)];

    if (query.branchId) {
      conditions.push(eq(members.homeBranchId, query.branchId));
    }

    if (query.status) {
      conditions.push(eq(members.status, query.status));
    }

    if (query.search && query.search.trim().length > 0) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(members.memberNumber, s),
          ilike(users.fullName, s),
          ilike(users.phone, s),
          ilike(users.email, s),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [totalResult] = await this.db
      .select({ count: count(members.id) })
      .from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    const memberList = await this.db
      .select({
        id: members.id,
        memberNumber: members.memberNumber,
        status: members.status,
        gender: members.gender,
        dateOfBirth: members.dateOfBirth,
        emergencyContact: members.emergencyContact,
        createdAt: members.createdAt,
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
      .where(whereClause)
      .orderBy(desc(members.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items: memberList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get member profile with active memberships and home branch details
   * Strictly tenant-scoped by gymId AND memberId.
   */
  async getMemberById(gymId: string, memberId: string) {
    const member = await this.db
      .select({
        id: members.id,
        gymId: members.gymId,
        memberNumber: members.memberNumber,
        status: members.status,
        gender: members.gender,
        dateOfBirth: members.dateOfBirth,
        emergencyContact: members.emergencyContact,
        homeBranchId: members.homeBranchId,
        createdAt: members.createdAt,
        user: {
          id: users.id,
          fullName: users.fullName,
          phone: users.phone,
          email: users.email,
        },
      })
      .from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(scopeEntityToGym(members, gymId, memberId))
      .limit(1);

    if (member.length === 0) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Member not found',
      });
    }

    const memberData = member[0];

    // Fetch active memberships
    const activeMemberships = await this.db.query.memberships.findMany({
      where: scopeToGym(memberships, gymId, eq(memberships.memberId, memberId)),
      orderBy: [desc(memberships.startDate)],
    });

    let homeBranch = null;
    if (memberData.homeBranchId) {
      homeBranch = await this.db.query.branches.findFirst({
        where: scopeEntityToGym(branches, gymId, memberData.homeBranchId),
      });
    }

    return {
      ...memberData,
      homeBranch,
      memberships: activeMemberships,
    };
  }

  /**
   * Update member personal details or status
   */
  async updateMember(
    gymId: string,
    memberId: string,
    rawInput: unknown,
    actorUserId?: string,
  ) {
    const parseResult = updateMemberSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid member update data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const existing = await this.db.query.members.findFirst({
      where: scopeEntityToGym(members, gymId, memberId),
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Member not found',
      });
    }

    const input: UpdateMemberInput = parseResult.data;

    // If home branch is changing, verify tenant ownership
    if (input.homeBranchId) {
      const branch = await this.db.query.branches.findFirst({
        where: scopeEntityToGym(branches, gymId, input.homeBranchId),
      });
      if (!branch) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Specified homeBranchId is invalid or belongs to another gym',
        });
      }
    }

    return await this.db.transaction(async (tx) => {
      // Update base user info if fullName or email changed
      if (input.fullName || input.email) {
        await tx
          .update(users)
          .set({
            ...(input.fullName
              ? { fullName: input.fullName, nameSearch: input.fullName.toLowerCase() }
              : {}),
            ...(input.email ? { email: input.email.toLowerCase().trim() } : {}),
          })
          .where(eq(users.id, existing.userId));
      }

      const [updated] = await tx
        .update(members)
        .set({
          ...(input.homeBranchId !== undefined ? { homeBranchId: input.homeBranchId } : {}),
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
          ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth } : {}),
          ...(input.emergencyContact !== undefined
            ? { emergencyContact: input.emergencyContact }
            : {}),
        })
        .where(scopeEntityToGym(members, gymId, memberId))
        .returning();

      // Audit log
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'member.update',
        entityType: 'member',
        entityId: memberId,
        payload: {
          updatedFields: Object.keys(input),
        },
      });

      return updated;
    });
  }

  /**
   * Archive a member - strictly blocked if any membership is currently frozen or has an active freeze
   */
  async archiveMember(gymId: string, memberId: string, actorUserId?: string) {
    const existing = await this.db.query.members.findFirst({
      where: scopeEntityToGym(members, gymId, memberId),
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Member not found',
      });
    }

    // Spec Requirement: Block member archiving while a freeze is live
    const frozenMembership = await this.db.query.memberships.findFirst({
      where: and(
        eq(memberships.gymId, gymId),
        eq(memberships.memberId, memberId),
        eq(memberships.status, 'frozen'),
      ),
    });
    if (frozenMembership) {
      throw new BadRequestException({
        code: 'LIVE_FREEZE_ACTIVE',
        message: 'Cannot archive a member with an active freeze on their membership',
      });
    }

    const [updated] = await this.db
      .update(members)
      .set({
        status: 'archived',
      })
      .where(scopeEntityToGym(members, gymId, memberId))
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'member.archive',
      entityType: 'member',
      entityId: memberId,
      payload: { previousStatus: existing.status, newStatus: 'archived' },
    });

    return updated;
  }
}
