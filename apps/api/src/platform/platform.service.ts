import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
  authUsers,
  branches,
  gymDocuments,
  gyms,
  members,
  platformAdmins,
  staffAssignments,
  users,
} from '../db/schema';
import { AuditService } from '../common/audit/audit.service';
import { EmailService } from '../common/email/email.service';

@Injectable()
export class PlatformService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * High-level platform statistics (total gyms, status breakdown, branches, members)
   */
  async getOverview() {
    const [gymStats] = await this.db
      .select({
        totalGyms: count(gyms.id),
        activeGyms: count(sql`CASE WHEN ${gyms.status} = 'active' THEN 1 END`),
        pendingGyms: count(sql`CASE WHEN ${gyms.status} = 'pending_verification' THEN 1 END`),
        suspendedGyms: count(sql`CASE WHEN ${gyms.status} = 'suspended' THEN 1 END`),
        closedGyms: count(sql`CASE WHEN ${gyms.status} = 'closed' THEN 1 END`),
      })
      .from(gyms);

    const [branchStats] = await this.db
      .select({ totalBranches: count(branches.id) })
      .from(branches);

    const [memberStats] = await this.db
      .select({ totalMembers: count(members.id) })
      .from(members);

    const [adminStats] = await this.db
      .select({ totalAdmins: count(platformAdmins.id) })
      .from(platformAdmins)
      .where(eq(platformAdmins.isActive, true));

    return {
      gyms: gymStats,
      branches: branchStats,
      members: memberStats,
      admins: adminStats,
    };
  }

  /**
   * List all gyms across the platform with filtering, search, and pagination
   */
  async getGyms(query: {
    status?: 'pending_verification' | 'active' | 'suspended' | 'closed';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.status) {
      conditions.push(eq(gyms.status, query.status));
    }

    if (query.search && query.search.trim().length > 0) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(gyms.legalName, s),
          ilike(gyms.tradeName, s),
          ilike(gyms.tradeLicenseNumber, s),
          ilike(gyms.trnNumber, s),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await this.db
      .select({ count: count(gyms.id) })
      .from(gyms)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    const gymList = await this.db
      .select({
        id: gyms.id,
        legalName: gyms.legalName,
        tradeName: gyms.tradeName,
        tradeLicenseNumber: gyms.tradeLicenseNumber,
        vatRegistered: gyms.vatRegistered,
        trnNumber: gyms.trnNumber,
        timezone: gyms.timezone,
        currency: gyms.currency,
        status: gyms.status,
        createdAt: gyms.createdAt,
      })
      .from(gyms)
      .where(whereClause)
      .orderBy(desc(gyms.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich with owner info and branch counts
    const enriched = await Promise.all(
      gymList.map(async (gym) => {
        const ownerRow = await this.db
          .select({
            userId: staffAssignments.userId,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
          })
          .from(staffAssignments)
          .innerJoin(users, eq(staffAssignments.userId, users.id))
          .where(
            and(
              eq(staffAssignments.gymId, gym.id),
              eq(staffAssignments.role, 'owner'),
            ),
          )
          .limit(1);

        const [branchCount] = await this.db
          .select({ count: count(branches.id) })
          .from(branches)
          .where(eq(branches.gymId, gym.id));

        return {
          ...gym,
          branchCount: Number(branchCount?.count || 0),
          owner: ownerRow[0] ?? null,
        };
      }),
    );

    return {
      items: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single gym details for platform admin review
   */
  async getGymById(gymId: string) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    const [branchCount] = await this.db
      .select({ count: count(branches.id) })
      .from(branches)
      .where(eq(branches.gymId, gymId));

    const [staffCount] = await this.db
      .select({ count: count(staffAssignments.id) })
      .from(staffAssignments)
      .where(eq(staffAssignments.gymId, gymId));

    const [memberCount] = await this.db
      .select({ count: count(members.id) })
      .from(members)
      .where(eq(members.gymId, gymId));

    return {
      ...gym,
      totalBranches: Number(branchCount?.count || 0),
      totalStaff: Number(staffCount?.count || 0),
      totalMembers: Number(memberCount?.count || 0),
    };
  }

  /**
   * Platform Verification Review Queue:
   * Returns all gyms currently pending verification, including owner details and uploaded verification documents.
   */
  async getReviewQueue() {
    const pendingGyms = await this.db.query.gyms.findMany({
      where: eq(gyms.status, 'pending_verification'),
      orderBy: [desc(gyms.createdAt)],
    });

    const enrichedQueue = await Promise.all(
      pendingGyms.map(async (gym) => {
        const ownerRow = await this.db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
          })
          .from(staffAssignments)
          .innerJoin(users, eq(staffAssignments.userId, users.id))
          .where(and(eq(staffAssignments.gymId, gym.id), eq(staffAssignments.role, 'owner')))
          .limit(1);

        const documents = await this.db.query.gymDocuments.findMany({
          where: eq(gymDocuments.gymId, gym.id),
        });

        const defaultBranch = await this.db.query.branches.findFirst({
          where: eq(branches.gymId, gym.id),
        });

        return {
          ...gym,
          owner: ownerRow[0] ?? null,
          documents,
          defaultBranch: defaultBranch ?? null,
        };
      }),
    );

    return enrichedQueue;
  }

  /**
   * Approve gym verification:
   * 1. Updates gym status to 'active'
   * 2. Logs cryptographic audit entry
   * 3. Dispatches official approval email to the gym owner
   */
  async approveGym(
    gymId: string,
    input?: { reason?: string; notes?: string },
    adminActorId?: string,
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

    const [updated] = await this.db
      .update(gyms)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(gyms.id, gymId))
      .returning();

    // Fetch owner details for email notification
    const ownerRow = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      })
      .from(staffAssignments)
      .innerJoin(users, eq(staffAssignments.userId, users.id))
      .where(and(eq(staffAssignments.gymId, gymId), eq(staffAssignments.role, 'owner')))
      .limit(1);

    const owner = ownerRow[0];

    // Record audit log entry
    await this.auditService.log({
      gymId,
      adminActorId: adminActorId ?? null,
      action: 'gym.approved',
      entityType: 'gym',
      entityId: gymId,
      reasonCode: input?.reason || 'verification_approved',
      payload: {
        previousStatus: gym.status,
        newStatus: 'active',
        notes: input?.notes ?? null,
        ownerEmail: owner?.email ?? null,
      },
    });

    // Send email notification to owner
    if (owner?.email) {
      await this.emailService.sendGymApprovedEmail({
        ownerEmail: owner.email,
        ownerName: owner.fullName,
        gymName: gym.tradeName,
        reason: input?.notes || input?.reason,
      });
    }

    return updated;
  }

  /**
   * Reject gym verification:
   * 1. Requires mandatory rejection reason
   * 2. Updates gym status to 'rejected'
   * 3. Logs cryptographic audit entry
   * 4. Dispatches rejection email with mandatory reason to gym owner
   */
  async rejectGym(
    gymId: string,
    input: { reason: string },
    adminActorId?: string,
  ) {
    if (!input || !input.reason || typeof input.reason !== 'string' || !input.reason.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'A mandatory rejection reason is required',
      });
    }

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    const [updated] = await this.db
      .update(gyms)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(gyms.id, gymId))
      .returning();

    // Fetch owner details for email notification
    const ownerRow = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      })
      .from(staffAssignments)
      .innerJoin(users, eq(staffAssignments.userId, users.id))
      .where(and(eq(staffAssignments.gymId, gymId), eq(staffAssignments.role, 'owner')))
      .limit(1);

    const owner = ownerRow[0];

    // Record audit log entry
    await this.auditService.log({
      gymId,
      adminActorId: adminActorId ?? null,
      action: 'gym.rejected',
      entityType: 'gym',
      entityId: gymId,
      reasonCode: input.reason.trim(),
      payload: {
        previousStatus: gym.status,
        newStatus: 'rejected',
        reason: input.reason.trim(),
        ownerEmail: owner?.email ?? null,
      },
    });

    // Send email notification to owner with reason
    if (owner?.email) {
      await this.emailService.sendGymRejectedEmail({
        ownerEmail: owner.email,
        ownerName: owner.fullName,
        gymName: gym.tradeName,
        reason: input.reason.trim(),
      });
    }

    return updated;
  }

  /**
   * Suspend gym verification/operations:
   * 1. Requires mandatory reason
   * 2. Updates gym status to 'suspended'
   * 3. Logs cryptographic audit entry
   * 4. Dispatches suspension email with reason to gym owner
   */
  async suspendGym(
    gymId: string,
    input: { reason: string },
    adminActorId?: string,
  ) {
    if (!input || !input.reason || typeof input.reason !== 'string' || !input.reason.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'A mandatory suspension reason is required',
      });
    }

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    const [updated] = await this.db
      .update(gyms)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(gyms.id, gymId))
      .returning();

    const ownerRow = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      })
      .from(staffAssignments)
      .innerJoin(users, eq(staffAssignments.userId, users.id))
      .where(and(eq(staffAssignments.gymId, gymId), eq(staffAssignments.role, 'owner')))
      .limit(1);

    const owner = ownerRow[0];

    await this.auditService.log({
      gymId,
      adminActorId: adminActorId ?? null,
      action: 'gym.suspended',
      entityType: 'gym',
      entityId: gymId,
      reasonCode: input.reason.trim(),
      payload: {
        previousStatus: gym.status,
        newStatus: 'suspended',
        reason: input.reason.trim(),
        ownerEmail: owner?.email ?? null,
      },
    });

    if (owner?.email) {
      await this.emailService.sendGymSuspendedEmail({
        ownerEmail: owner.email,
        ownerName: owner.fullName,
        gymName: gym.tradeName,
        reason: input.reason.trim(),
      });
    }

    return updated;
  }

  /**
   * Reactivate gym verification/operations:
   * 1. Requires mandatory reason
   * 2. Updates gym status to 'active'
   * 3. Logs cryptographic audit entry
   * 4. Dispatches reactivation email with reason to gym owner
   */
  async reactivateGym(
    gymId: string,
    input: { reason: string },
    adminActorId?: string,
  ) {
    if (!input || !input.reason || typeof input.reason !== 'string' || !input.reason.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'A mandatory reactivation reason is required',
      });
    }

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    const [updated] = await this.db
      .update(gyms)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(gyms.id, gymId))
      .returning();

    const ownerRow = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      })
      .from(staffAssignments)
      .innerJoin(users, eq(staffAssignments.userId, users.id))
      .where(and(eq(staffAssignments.gymId, gymId), eq(staffAssignments.role, 'owner')))
      .limit(1);

    const owner = ownerRow[0];

    await this.auditService.log({
      gymId,
      adminActorId: adminActorId ?? null,
      action: 'gym.reactivated',
      entityType: 'gym',
      entityId: gymId,
      reasonCode: input.reason.trim(),
      payload: {
        previousStatus: gym.status,
        newStatus: 'active',
        reason: input.reason.trim(),
        ownerEmail: owner?.email ?? null,
      },
    });

    if (owner?.email) {
      await this.emailService.sendGymReactivatedEmail({
        ownerEmail: owner.email,
        ownerName: owner.fullName,
        gymName: gym.tradeName,
        reason: input.reason.trim(),
      });
    }

    return updated;
  }

  /**
   * List all platform administrators
   */
  async getPlatformAdmins() {
    const adminList = await this.db
      .select({
        id: platformAdmins.id,
        userId: platformAdmins.userId,
        role: platformAdmins.role,
        isActive: platformAdmins.isActive,
        createdAt: platformAdmins.createdAt,
        user: {
          name: users.fullName,
          email: users.email,
        },
      })
      .from(platformAdmins)
      .innerJoin(users, eq(platformAdmins.userId, users.id));

    return adminList;
  }

  /**
   * Grant platform admin privileges to a user by email (Requires reason)
   */
  async addPlatformAdmin(input: {
    email: string;
    role?: 'superadmin' | 'support' | 'auditor';
    reason: string;
    inviterAdminId?: string;
  }) {
    if (!input.email) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Email is required',
      });
    }

    if (!input.reason || typeof input.reason !== 'string' || !input.reason.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'A reason is required when promoting a platform administrator',
      });
    }

    const authUser = await this.db.query.authUsers.findFirst({
      where: eq(authUsers.email, input.email.toLowerCase().trim()),
    });

    if (!authUser) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: `No user with email '${input.email}' found. The user must register an account first.`,
      });
    }

    // Resolve domain user UUID
    let domainUser = await this.db.query.users.findFirst({
      where: eq(users.authUserId, authUser.id),
    });

    if (!domainUser) {
      const [createdUser] = await this.db
        .insert(users)
        .values({
          authUserId: authUser.id,
          email: authUser.email,
          fullName: authUser.name || authUser.email.split('@')[0],
          nameSearch: (authUser.name || authUser.email.split('@')[0]).toLowerCase(),
        })
        .returning();
      domainUser = createdUser;
    }

    const existingAdmin = await this.db.query.platformAdmins.findFirst({
      where: eq(platformAdmins.userId, domainUser.id),
    });

    if (existingAdmin) {
      if (!existingAdmin.isActive) {
        // Reactivate
        const [reactivated] = await this.db
          .update(platformAdmins)
          .set({
            isActive: true,
            role: input.role ?? existingAdmin.role,
            updatedAt: new Date(),
          })
          .where(eq(platformAdmins.id, existingAdmin.id))
          .returning();

        await this.auditService.log({
          adminActorId: input.inviterAdminId ?? null,
          action: 'platform_admin.reactivated',
          entityType: 'platform_admin',
          entityId: reactivated.id,
          reasonCode: input.reason.trim(),
          payload: {
            targetUserId: domainUser.id,
            email: input.email,
            role: reactivated.role,
            reason: input.reason.trim(),
          },
        });

        return reactivated;
      }
      throw new ConflictException({
        code: 'CONFLICT',
        message: `User '${input.email}' is already a platform admin`,
      });
    }

    const [created] = await this.db
      .insert(platformAdmins)
      .values({
        userId: domainUser.id,
        role: input.role ?? 'superadmin',
        isActive: true,
      })
      .returning();

    await this.auditService.log({
      adminActorId: input.inviterAdminId ?? null,
      action: 'platform_admin.create',
      entityType: 'platform_admin',
      entityId: created.id,
      reasonCode: input.reason.trim(),
      payload: {
        targetUserId: domainUser.id,
        email: input.email,
        role: created.role,
        reason: input.reason.trim(),
      },
    });

    return created;
  }

  /**
   * Deactivate or activate a platform admin
   */
  async setAdminActiveStatus(adminId: string, isActive: boolean, reason?: string, adminActorId?: string) {
    const [updated] = await this.db
      .update(platformAdmins)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(platformAdmins.id, adminId))
      .returning();

    if (!updated) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Platform admin not found',
      });
    }

    await this.auditService.log({
      adminActorId: adminActorId ?? null,
      action: 'platform_admin.status_change',
      entityType: 'platform_admin',
      entityId: adminId,
      reasonCode: reason ?? null,
      payload: {
        isActive,
        reason: reason ?? null,
      },
    });

    return updated;
  }

  /**
   * Platform-wide audit history (all gyms + platform events)
   */
  async getPlatformAuditLogs(limit = 100) {
    return await this.auditService.verifyChainIntegrity(limit);
  }
}
