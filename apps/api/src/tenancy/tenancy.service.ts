import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
  authSessions,
  authUsers,
  authVerifications,
  branches,
  gymDocuments,
  gymPaymentAccounts,
  gyms,
  managerPins,
  staffAssignments,
  staffBranchAccess,
  users,
} from '../db/schema';
import {
  createGymSchema,
  type CreateGymInput,
  assignStaffSchema,
  type AssignStaffInput,
  setManagerPinSchema,
} from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { EmailService } from '../common/email/email.service';
import { encryptAes256Gcm } from '../common/crypto/aes-gcm';
import { hashPin } from '../common/crypto/pin-hasher';
import { PlatformSecretsService } from '../common/secrets/platform-secrets.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';

export interface UpdatePaymentConfigDto {
  defaultProvider?: 'tap' | 'razorpay' | 'stripe';
  accounts?: Array<{
    provider: 'tap' | 'razorpay' | 'stripe';
    providerAccountId: string;
    currency?: string;
    status?: 'not_started' | 'onboarding' | 'restricted' | 'active' | 'disabled';
    interimSecret?: string;
  }>;
  providers?: {
    tap?: {
      enabled?: boolean;
      merchantId?: string;
      providerAccountId?: string;
      publicKey?: string;
      secretKey?: string;
      currency?: string;
      webhookSecret?: string;
    };
    razorpay?: {
      enabled?: boolean;
      accountId?: string;
      providerAccountId?: string;
      keyId?: string;
      keySecret?: string;
      currency?: string;
      webhookSecret?: string;
    };
    stripe?: {
      enabled?: boolean;
      accountId?: string;
      providerAccountId?: string;
      publishableKey?: string;
      currency?: string;
    };
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuidString(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

@Injectable()
export class TenancyService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly platformSecrets: PlatformSecretsService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Onboard a new Gym:
   * 1. Validates input schema
   * 2. Synchronizes auth_user to users table
   * 3. Provisions gym row (pending_verification)
   * 4. Provisions default Main Branch
   * 5. Assigns creator as Owner in staff_assignments
   */
  async createGym(authUser: { id: string; email: string; name: string }, rawInput: unknown) {
    const parseResult = createGymSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid gym creation data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: PropertyKey[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: CreateGymInput = parseResult.data;

    // Resolve matching domain user first so we have guaranteed UUID
    const isIdUuid = isUuidString(authUser.id);
    let domainUser = await this.db.query.users.findFirst({
      where: isIdUuid ? eq(users.id, authUser.id) : eq(users.authUserId, authUser.id),
    });

    if (!domainUser) {
      const [created] = await this.db
        .insert(users)
        .values({
          authUserId: isIdUuid ? null : authUser.id,
          email: authUser.email,
          fullName: authUser.name || 'Owner',
          nameSearch: (authUser.name || 'Owner').toLowerCase(),
          status: 'active',
        })
        .returning();
      domainUser = created;
    }

    // Cap: A user may create and own only one gym with active/pending/suspended status during Phase 1
    const existingOwnerships = await this.db
      .select({
        id: staffAssignments.id,
        gymStatus: gyms.status,
      })
      .from(staffAssignments)
      .innerJoin(gyms, eq(staffAssignments.gymId, gyms.id))
      .where(
        and(
          eq(staffAssignments.userId, domainUser.id),
          eq(staffAssignments.role, 'owner'),
          eq(staffAssignments.isActive, true),
          inArray(gyms.status, ['pending_verification', 'active', 'suspended']),
        ),
      );

    if (existingOwnerships.length > 0) {
      throw new BadRequestException({
        code: 'GYM_CREATION_LIMIT_EXCEEDED',
        message: 'A user may only create and own one active or pending gym',
      });
    }

    // Check TRN uniqueness if provided
    if (input.trnNumber) {
      const existingTrn = await this.db.query.gyms.findFirst({
        where: eq(gyms.trnNumber, input.trnNumber),
      });
      if (existingTrn) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `A gym with TRN '${input.trnNumber}' already exists`,
        });
      }
    }

    // Execute atomically
    const result = await this.db.transaction(async (tx) => {
      // 1. Insert gym
      const [newGym] = await tx
        .insert(gyms)
        .values({
          legalName: input.legalName,
          tradeName: input.tradeName,
          tradeLicenseNumber: input.tradeLicenseNumber,
          vatRegistered: input.vatRegistered,
          trnNumber: input.trnNumber ?? null,
          timezone: input.timezone,
          currency: input.currency,
          status: 'pending_verification',
          settings: input.settings ?? {},
        })
        .returning();

      // 2. Create initial default branch
      const [defaultBranch] = await tx
        .insert(branches)
        .values({
          gymId: newGym.id,
          name: 'Main Branch',
          address: {
            city: 'Dubai',
            emirate: 'Dubai',
            country: 'United Arab Emirates',
          },
          isActive: true,
        })
        .returning();

      // 3. Assign creator as owner
      const [assignment] = await tx
        .insert(staffAssignments)
        .values({
          gymId: newGym.id,
          userId: domainUser.id,
          role: 'owner',
          branchScope: 'all',
          isActive: true,
        })
        .returning();

      // 4. Append tamper-evident audit record inside transaction
      await this.auditService.log(
        {
          gymId: newGym.id,
          actorUserId: domainUser.id,
          actorRole: 'owner',
          action: 'gym.create',
          entityType: 'gym',
          entityId: newGym.id,
          payload: {
            legalName: newGym.legalName,
            tradeName: newGym.tradeName,
            currency: newGym.currency,
          },
        },
        tx,
      );

      return {
        gym: newGym,
        defaultBranch,
        staffAssignment: assignment,
      };
    });

    return result;
  }

  /**
   * List all gyms where the authenticated user has an active staff role
   */
  async getUserGyms(userId: string) {
    const isIdUuid = isUuidString(userId);
    const rows = await this.db
      .select({
        gymId: staffAssignments.gymId,
        role: staffAssignments.role,
        branchScope: staffAssignments.branchScope,
        assignedAt: staffAssignments.createdAt,
        gym: {
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
        },
      })
      .from(staffAssignments)
      .innerJoin(gyms, eq(staffAssignments.gymId, gyms.id))
      .innerJoin(users, eq(staffAssignments.userId, users.id))
      .where(
        and(
          isIdUuid ? eq(staffAssignments.userId, userId) : eq(users.authUserId, userId),
          eq(staffAssignments.isActive, true),
        ),
      );

    const gymIds = rows.map((r) => r.gymId);
    let allBranches: Array<{ id: string; gymId: string; name: string; isActive: boolean; address: unknown }> = [];
    if (gymIds.length > 0) {
      allBranches = await this.db.query.branches.findMany({
        where: inArray(branches.gymId, gymIds),
      });
    }

    return rows.map((r) => {
      const gymBranches = allBranches.filter((b) => b.gymId === r.gymId);
      return {
        ...r,
        gym: {
          ...r.gym,
          branches: gymBranches,
        },
      };
    });
  }

  /**
   * Get single gym details for a tenant
   */
  async getGymDetails(gymId: string) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      return null;
    }

    const branchList = await this.db.query.branches.findMany({
      where: scopeToGym(branches, gymId),
    });

    return {
      ...gym,
      branches: branchList,
    };
  }

  /**
   * List all staff assigned to this gym (active and inactive, with assigned branches)
   */
  async getGymStaff(gymId: string) {
    const staff = await this.db
      .select({
        id: staffAssignments.id,
        userId: staffAssignments.userId,
        role: staffAssignments.role,
        branchScope: staffAssignments.branchScope,
        isActive: staffAssignments.isActive,
        createdAt: staffAssignments.createdAt,
        user: {
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          status: users.status,
        },
      })
      .from(staffAssignments)
      .innerJoin(users, eq(staffAssignments.userId, users.id))
      .where(scopeToGym(staffAssignments, gymId));

    const staffIds = staff.map((s) => s.id);
    const branchAccessMap = new Map<string, Array<{ id: string; name: string }>>();

    if (staffIds.length > 0) {
      const accessRows = await this.db
        .select({
          staffAssignmentId: staffBranchAccess.staffAssignmentId,
          branchId: branches.id,
          branchName: branches.name,
        })
        .from(staffBranchAccess)
        .innerJoin(branches, eq(staffBranchAccess.branchId, branches.id))
        .where(
          scopeToGym(
            staffBranchAccess,
            gymId,
            inArray(staffBranchAccess.staffAssignmentId, staffIds),
          ),
        );

      for (const row of accessRows) {
        const existing = branchAccessMap.get(row.staffAssignmentId) || [];
        existing.push({ id: row.branchId, name: row.branchName });
        branchAccessMap.set(row.staffAssignmentId, existing);
      }
    }

    return staff.map((s) => ({
      ...s,
      assignedBranches: branchAccessMap.get(s.id) || [],
    }));
  }

  /**
   * Assign or update a staff member for this gym (Accepts userId or email)
   */
  async assignStaff(gymId: string, rawInput: unknown, actorUserId?: string) {
    const parseResult = assignStaffSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid staff assignment data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: PropertyKey[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: AssignStaffInput = parseResult.data;

    // Check user existence by userId or email
    let authUser = input.userId
      ? await this.db.query.authUsers.findFirst({
          where: eq(authUsers.id, input.userId),
        })
      : null;

    if (!authUser && input.email) {
      authUser = await this.db.query.authUsers.findFirst({
        where: eq(authUsers.email, input.email.toLowerCase().trim()),
      });
    }

    // If user does not exist in auth system yet, provision a pending authUser
    if (!authUser && input.email) {
      const tempId = `usr_inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const staffName = input.fullName || input.email.split('@')[0];
      const [newAuthUser] = await this.db
        .insert(authUsers)
        .values({
          id: tempId,
          name: staffName,
          email: input.email.toLowerCase().trim(),
          emailVerified: false,
        })
        .returning();
      authUser = newAuthUser;
    }

    if (!authUser) {
      throw new BadRequestException({
        code: 'RESOURCE_NOT_FOUND',
        message: `User '${input.userId || input.email}' not found in authentication system`,
      });
    }

    const resolvedUserId = authUser.id;

    // Verify branch existence if selected
    if (input.branchScope === 'selected' && input.branchIds.length > 0) {
      const existingBranches = await this.db.query.branches.findMany({
        where: scopeToGym(
          branches,
          gymId,
          inArray(branches.id, input.branchIds),
        ),
      });

      if (existingBranches.length !== input.branchIds.length) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'One or more specified branch IDs are invalid or belong to another gym',
        });
      }
    }

    const result = await this.db.transaction(async (tx) => {
      // Ensure target user exists in users table with UUID
      const isTargetUuid = isUuidString(resolvedUserId);
      let domainUser = await tx.query.users.findFirst({
        where: isTargetUuid ? eq(users.id, resolvedUserId) : eq(users.authUserId, resolvedUserId),
      });

      if (!domainUser) {
        const [created] = await tx
          .insert(users)
          .values({
            authUserId: authUser.id,
            email: authUser.email,
            fullName: input.fullName || authUser.name || 'Staff Member',
            nameSearch: (input.fullName || authUser.name || 'Staff Member').toLowerCase(),
            status: 'active',
          })
          .returning();
        domainUser = created;
      }

      // Check if assignment exists
      const existingAssignment = await tx.query.staffAssignments.findFirst({
        where: scopeToGym(
          staffAssignments,
          gymId,
          eq(staffAssignments.userId, domainUser.id),
        ),
      });

      let assignmentId: string;

      if (existingAssignment) {
        const [updated] = await tx
          .update(staffAssignments)
          .set({
            role: input.role,
            branchScope: input.branchScope,
            isActive: true,
          })
          .where(eq(staffAssignments.id, existingAssignment.id))
          .returning();
        assignmentId = updated.id;
      } else {
        const [created] = await tx
          .insert(staffAssignments)
          .values({
            gymId,
            userId: domainUser.id,
            role: input.role,
            branchScope: input.branchScope,
            isActive: true,
          })
          .returning();
        assignmentId = created.id;
      }

      // Sync branch access (tenant-scoped)
      await tx
        .delete(staffBranchAccess)
        .where(
          scopeToGym(
            staffBranchAccess,
            gymId,
            eq(staffBranchAccess.staffAssignmentId, assignmentId),
          ),
        );

      if (input.branchScope === 'selected' && input.branchIds.length > 0) {
        for (const branchId of input.branchIds) {
          await tx.insert(staffBranchAccess).values({
            gymId,
            staffAssignmentId: assignmentId,
            branchId,
          });
        }
      }

      return {
        assignmentId,
        gymId,
        userId: resolvedUserId,
        role: input.role,
        branchScope: input.branchScope,
        branchIds: input.branchScope === 'selected' ? input.branchIds : [],
      };
    });

    // Send invitation email
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    try {
      await this.emailService.sendStaffInvitationEmail({
        to: authUser.email,
        name: input.fullName || authUser.name || 'Staff Member',
        gymName: gym?.tradeName || 'Your Gym',
        role: input.role,
      });
    } catch (err: any) {
      // Non-fatal if email provider fails
    }

    // Record audit trail
    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'staff.assign',
      entityType: 'staff_assignment',
      entityId: result.assignmentId,
      payload: {
        targetUserId: resolvedUserId,
        targetEmail: authUser.email,
        role: input.role,
        branchScope: input.branchScope,
      },
    });

    return result;
  }

  /**
   * Toggle staff active / disabled status (Owner only)
   * When deactivated, invalidates user's active sessions in auth_session.
   */
  async updateStaffStatus(
    gymId: string,
    staffAssignmentId: string,
    isActive: boolean,
    actorUserId?: string,
  ) {
    const assignment = await this.db.query.staffAssignments.findFirst({
      where: scopeToGym(staffAssignments, gymId, eq(staffAssignments.id, staffAssignmentId)),
    });

    if (!assignment) {
      throw new BadRequestException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Staff assignment not found',
      });
    }

    // Guard: Prevent self-deactivation
    if (actorUserId) {
      const actorUser = await this.db.query.users.findFirst({
        where: isUuidString(actorUserId)
          ? eq(users.id, actorUserId)
          : eq(users.authUserId, actorUserId),
      });
      if (actorUser && actorUser.id === assignment.userId && !isActive) {
        throw new BadRequestException({
          code: 'CANNOT_DEACTIVATE_SELF',
          message: 'You cannot deactivate your own staff account.',
        });
      }
    }

    // Guard: Prevent deactivating the last active owner
    if (assignment.role === 'owner' && !isActive) {
      const activeOwners = await this.db
        .select()
        .from(staffAssignments)
        .where(
          scopeToGym(
            staffAssignments,
            gymId,
            and(eq(staffAssignments.role, 'owner'), eq(staffAssignments.isActive, true)),
          ),
        );

      if (activeOwners.length <= 1) {
        throw new BadRequestException({
          code: 'CANNOT_DEACTIVATE_LAST_OWNER',
          message: 'Cannot deactivate the sole remaining owner of the gym.',
        });
      }
    }

    // Update assignment
    const [updated] = await this.db
      .update(staffAssignments)
      .set({ isActive })
      .where(eq(staffAssignments.id, staffAssignmentId))
      .returning();

    // If deactivated, revoke all active sessions for the user in Better Auth
    if (!isActive) {
      const domainUser = await this.db.query.users.findFirst({
        where: eq(users.id, assignment.userId),
      });
      if (domainUser?.authUserId) {
        await this.db
          .delete(authSessions)
          .where(eq(authSessions.userId, domainUser.authUserId));
      }
    }

    // Audit trail
    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: isActive ? 'staff.activate' : 'staff.deactivate',
      entityType: 'staff_assignment',
      entityId: staffAssignmentId,
      payload: {
        targetUserId: assignment.userId,
        isActive,
      },
    });

    return {
      success: true,
      id: updated.id,
      isActive: updated.isActive,
    };
  }

  /**
   * Reset staff password via transactional email (Owner only)
   */
  async resetStaffPassword(
    gymId: string,
    staffAssignmentId: string,
    actorUserId?: string,
  ) {
    const assignment = await this.db.query.staffAssignments.findFirst({
      where: scopeToGym(staffAssignments, gymId, eq(staffAssignments.id, staffAssignmentId)),
    });

    if (!assignment) {
      throw new BadRequestException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Staff assignment not found',
      });
    }

    const domainUser = await this.db.query.users.findFirst({
      where: eq(users.id, assignment.userId),
    });

    if (!domainUser || !domainUser.email) {
      throw new BadRequestException({
        code: 'INVALID_STAFF_RECORD',
        message: 'Target staff member does not have a registered email address.',
      });
    }

    // Generate reset token and persist in auth_verification (1-hour expiry)
    const resetToken = `rst_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    await this.db.insert(authVerifications).values({
      id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      identifier: domainUser.email.toLowerCase().trim(),
      value: resetToken,
      expiresAt,
    });

    const resetUrl = `https://app.gympulse.io/#/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(domainUser.email)}`;

    await this.emailService.sendPasswordReset({
      to: domainUser.email,
      name: domainUser.fullName,
      resetUrl,
    });

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'staff.reset_password',
      entityType: 'staff_assignment',
      entityId: staffAssignmentId,
      payload: {
        targetUserId: assignment.userId,
        targetEmail: domainUser.email,
      },
    });

    return {
      success: true,
      message: `Password reset email dispatched to ${domainUser.email}`,
    };
  }

  /**
   * Configure provider accounts for this gym.
   * Architecture:
   * - Platform master API keys live in secrets manager / environment.
   * - Gyms store only provider account IDs (Razorpay Route linked account ID, Tap merchant ID, Stripe connect account ID) in gym_payment_accounts.
   * - If an interim secret is provided, it is encrypted with AES-256-GCM, stored in gym_payment_accounts, NEVER returned, and logged without the secret.
   * - Only the gym owner may set this.
   */
  async updatePaymentConfig(gymId: string, rawInput: unknown, actorUserId?: string) {
    if (!rawInput || typeof rawInput !== 'object') {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid payment provider configuration: payload must be an object',
      });
    }

    const input = rawInput as UpdatePaymentConfigDto;
    if (input.defaultProvider && !['tap', 'razorpay', 'stripe'].includes(input.defaultProvider)) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: `Invalid defaultProvider '${input.defaultProvider}'. Must be one of: ['tap', 'razorpay', 'stripe']`,
      });
    }

    const currentGym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!currentGym) {
      throw new BadRequestException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    // Verify actor has owner role if actorUserId is provided
    if (actorUserId) {
      const assignment = await this.db.query.staffAssignments.findFirst({
        where: scopeToGym(
          staffAssignments,
          gymId,
          and(
            eq(staffAssignments.userId, actorUserId),
            eq(staffAssignments.isActive, true),
          ),
        ),
      });

      if (!assignment || assignment.role !== 'owner') {
        throw new BadRequestException({
          code: 'FORBIDDEN',
          message: 'Only the gym owner is authorized to configure payment provider accounts',
        });
      }
    }

    // 1. Process structured accounts array if provided
    if (Array.isArray(input.accounts) && input.accounts.length > 0) {
      for (const acc of input.accounts) {
        let encryptedSecrets = null;
        if (acc.interimSecret) {
          encryptedSecrets = encryptAes256Gcm(acc.interimSecret);
        }

        await this.db
          .insert(gymPaymentAccounts)
          .values({
            gymId,
            provider: acc.provider,
            providerAccountId: acc.providerAccountId,
            currency: (acc.currency || (acc.provider === 'razorpay' ? 'INR' : 'AED')) as any,
            status: acc.status || 'active',
            chargesEnabled: true,
            payoutsEnabled: true,
            onboardingCompleted: true,
            detailsSubmitted: true,
            encryptedSecrets,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [gymPaymentAccounts.gymId, gymPaymentAccounts.provider],
            set: {
              providerAccountId: acc.providerAccountId,
              currency: (acc.currency || (acc.provider === 'razorpay' ? 'INR' : 'AED')) as any,
              status: acc.status || 'active',
              ...(encryptedSecrets ? { encryptedSecrets } : {}),
              updatedAt: new Date(),
            },
          });

        // Audit log without logging the secret
        await this.auditService.log({
          gymId,
          actorUserId: actorUserId ?? null,
          action: 'payment_account.update',
          entityType: 'gym_payment_account',
          entityId: acc.providerAccountId,
          payload: {
            provider: acc.provider,
            providerAccountId: acc.providerAccountId,
            currency: acc.currency || (acc.provider === 'razorpay' ? 'INR' : 'AED'),
            hasEncryptedSecret: !!encryptedSecrets,
          },
        });
      }
    }

    // 2. Process providers map (Tap, Razorpay Route, Stripe)
    if (input.providers) {
      const providerEntries: Array<{
        provider: 'tap' | 'razorpay' | 'stripe';
        accountId: string;
        currency: string;
        enabled: boolean;
        interimSecret?: string;
      }> = [];

      if (input.providers.tap) {
        const tap = input.providers.tap;
        const accountId = tap.merchantId || tap.providerAccountId;
        if (accountId) {
          providerEntries.push({
            provider: 'tap',
            accountId,
            currency: tap.currency || 'AED',
            enabled: tap.enabled !== false,
            interimSecret: tap.secretKey || tap.webhookSecret,
          });
        }
      }

      if (input.providers.razorpay) {
        const rzp = input.providers.razorpay;
        // Razorpay Route uses platform keys + gym linked-account ID
        const accountId = rzp.accountId || rzp.providerAccountId || rzp.keyId;
        if (accountId) {
          providerEntries.push({
            provider: 'razorpay',
            accountId,
            currency: rzp.currency || 'INR',
            enabled: rzp.enabled !== false,
            interimSecret: rzp.keySecret || rzp.webhookSecret,
          });
        }
      }

      if (input.providers.stripe) {
        const stripe = input.providers.stripe;
        const accountId = stripe.accountId || stripe.providerAccountId;
        if (accountId) {
          providerEntries.push({
            provider: 'stripe',
            accountId,
            currency: stripe.currency || 'AED',
            enabled: stripe.enabled !== false,
          });
        }
      }

      for (const entry of providerEntries) {
        let encryptedSecrets = null;
        if (entry.interimSecret) {
          // Encrypt with AES-256-GCM
          encryptedSecrets = encryptAes256Gcm(entry.interimSecret);
        }

        await this.db
          .insert(gymPaymentAccounts)
          .values({
            gymId,
            provider: entry.provider,
            providerAccountId: entry.accountId,
            currency: entry.currency as any,
            status: entry.enabled ? 'active' : 'disabled',
            chargesEnabled: entry.enabled,
            payoutsEnabled: entry.enabled,
            onboardingCompleted: entry.enabled,
            detailsSubmitted: entry.enabled,
            encryptedSecrets,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [gymPaymentAccounts.gymId, gymPaymentAccounts.provider],
            set: {
              providerAccountId: entry.accountId,
              currency: entry.currency as any,
              status: entry.enabled ? 'active' : 'disabled',
              chargesEnabled: entry.enabled,
              payoutsEnabled: entry.enabled,
              onboardingCompleted: entry.enabled,
              detailsSubmitted: entry.enabled,
              ...(encryptedSecrets ? { encryptedSecrets } : {}),
              updatedAt: new Date(),
            },
          });

        // Audit log without logging the secret
        await this.auditService.log({
          gymId,
          actorUserId: actorUserId ?? null,
          action: 'payment_account.update',
          entityType: 'gym_payment_account',
          entityId: entry.accountId,
          payload: {
            provider: entry.provider,
            providerAccountId: entry.accountId,
            currency: entry.currency,
            status: entry.enabled ? 'active' : 'disabled',
            hasEncryptedSecret: !!encryptedSecrets,
          },
        });
      }
    }

    return this.getPaymentConfig(gymId);
  }

  /**
   * Get payment accounts and provider configuration for this gym.
   * Secrets are NEVER returned.
   */
  async getPaymentConfig(gymId: string) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      return null;
    }

    const accounts = await this.db.query.gymPaymentAccounts.findMany({
      where: eq(gymPaymentAccounts.gymId, gymId),
    });

    const providers: Record<string, any> = {};
    for (const acc of accounts) {
      providers[acc.provider] = {
        enabled: acc.status === 'active',
        status: acc.status,
        providerAccountId: acc.providerAccountId,
        ...(acc.provider === 'tap' ? { merchantId: acc.providerAccountId } : {}),
        ...(acc.provider === 'razorpay' ? { accountId: acc.providerAccountId } : {}),
        ...(acc.provider === 'stripe' ? { accountId: acc.providerAccountId } : {}),
        currency: acc.currency,
        chargesEnabled: acc.chargesEnabled,
        payoutsEnabled: acc.payoutsEnabled,
        onboardingCompleted: acc.onboardingCompleted,
        hasInterimSecret: !!acc.encryptedSecrets,
      };
    }

    const defaultProvider = accounts.length > 0 ? accounts[0].provider : 'tap';

    return {
      defaultProvider,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        provider: acc.provider,
        providerAccountId: acc.providerAccountId,
        status: acc.status,
        currency: acc.currency,
        chargesEnabled: acc.chargesEnabled,
        payoutsEnabled: acc.payoutsEnabled,
        onboardingCompleted: acc.onboardingCompleted,
        detailsSubmitted: acc.detailsSubmitted,
        hasInterimSecret: !!acc.encryptedSecrets,
      })),
      providers,
    };
  }

  /**
   * Query all payment accounts directly for a gym
   */
  async getPaymentAccounts(gymId: string) {
    const accounts = await this.db.query.gymPaymentAccounts.findMany({
      where: scopeToGym(gymPaymentAccounts, gymId),
    });

    return accounts.map((acc) => ({
      id: acc.id,
      provider: acc.provider,
      providerAccountId: acc.providerAccountId,
      status: acc.status,
      currency: acc.currency,
      chargesEnabled: acc.chargesEnabled,
      payoutsEnabled: acc.payoutsEnabled,
      onboardingCompleted: acc.onboardingCompleted,
      detailsSubmitted: acc.detailsSubmitted,
      hasInterimSecret: !!acc.encryptedSecrets,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    }));
  }

  /**
   * Dedicated owner-only endpoint to get payment account (A2)
   */
  async getPaymentAccount(gymId: string, provider?: string) {
    const account = await this.db.query.gymPaymentAccounts.findFirst({
      where: provider
        ? and(scopeToGym(gymPaymentAccounts, gymId), eq(gymPaymentAccounts.provider, provider))
        : scopeToGym(gymPaymentAccounts, gymId),
      orderBy: [desc(gymPaymentAccounts.updatedAt)],
    });
    if (!account) return null;
    return {
      id: account.id,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      status: account.status,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      currency: account.currency,
    };
  }

  /**
   * Dedicated owner-only endpoint to set payment account (A2)
   */
  async setPaymentAccount(gymId: string, rawInput: any, actorUserId?: string) {
    if (!rawInput || typeof rawInput !== 'object') {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid payment account payload',
      });
    }

    const { provider, providerAccountId, status, currency } = rawInput;
    if (!provider || !providerAccountId) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'provider and providerAccountId are required',
      });
    }

    if (!['tap', 'razorpay'].includes(provider)) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: "provider must be 'tap' or 'razorpay'",
      });
    }

    const [account] = await this.db
      .insert(gymPaymentAccounts)
      .values({
        gymId,
        provider,
        providerAccountId,
        status: status || 'active',
        currency: currency || (provider === 'razorpay' ? 'INR' : 'AED'),
        chargesEnabled: true,
        payoutsEnabled: true,
        onboardingCompleted: true,
        detailsSubmitted: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [gymPaymentAccounts.gymId, gymPaymentAccounts.provider],
        set: {
          providerAccountId,
          status: status || 'active',
          currency: currency || (provider === 'razorpay' ? 'INR' : 'AED'),
          updatedAt: new Date(),
        },
      })
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'payment_account.set',
      entityType: 'gym_payment_account',
      entityId: account.id,
      payload: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        status: account.status,
      },
    });

    return {
      id: account.id,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      status: account.status,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      currency: account.currency,
    };
  }

  /**
   * Query gym audit trail (tenant-scoped)
   */
  async getAuditLogs(gymId: string, limit = 50) {
    return await this.auditService.getGymAuditLogs(gymId, limit);
  }

  /**
   * Update gym profile (allowed while pending verification)
   */
  async updateGymProfile(gymId: string, input: any, actorUserId?: string) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      throw new BadRequestException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    // Validate IANA timezone if provided
    if (input.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: input.timezone });
      } catch {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `Invalid IANA timezone: '${input.timezone}'`,
        });
      }
    }

    // Reverification rail: If gym is currently active, and modifying tradeLicenseNumber or trnNumber
    const touchesTrn = input.trnNumber !== undefined && input.trnNumber !== gym.trnNumber;
    const touchesLicense = input.tradeLicenseNumber !== undefined && input.tradeLicenseNumber !== gym.tradeLicenseNumber;
    const requiresReverification = gym.status === 'active' && (touchesTrn || touchesLicense);

    const [updated] = await this.db
      .update(gyms)
      .set({
        ...(input.legalName ? { legalName: input.legalName } : {}),
        ...(input.tradeName ? { tradeName: input.tradeName } : {}),
        ...(input.tradeLicenseNumber ? { tradeLicenseNumber: input.tradeLicenseNumber } : {}),
        ...(input.vatRegistered !== undefined ? { vatRegistered: Boolean(input.vatRegistered) } : {}),
        ...(input.trnNumber !== undefined ? { trnNumber: input.trnNumber } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.settings ? { settings: { ...(gym.settings as any), ...input.settings } } : {}),
        ...(requiresReverification ? { status: 'pending_verification' } : {}),
        updatedAt: new Date(),
      })
      .where(eq(gyms.id, gymId))
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'gym.profile_update',
      entityType: 'gym',
      entityId: gymId,
      payload: {
        updatedFields: Object.keys(input),
      },
    });

    if (requiresReverification) {
      await this.auditService.log({
        gymId,
        actorUserId: actorUserId ?? null,
        action: 'gym.reverification_triggered',
        entityType: 'gym',
        entityId: gymId,
        payload: {
          previousStatus: gym.status,
          newStatus: 'pending_verification',
          reason: 'Legal licensing or TRN modification on active gym requires platform re-verification',
          touchesTrn,
          touchesLicense,
        },
      });
    }

    return updated;
  }

  /**
   * Resubmit a rejected gym for platform verification review
   * Owner only.
   */
  async resubmitGym(gymId: string, actorUserId: string) {
    let domainUserId = actorUserId;
    const userRow = await this.db.query.users.findFirst({
      where: or(eq(users.id, actorUserId), eq(users.authUserId, actorUserId)),
    });
    if (userRow) {
      domainUserId = userRow.id;
    }

    const ownership = await this.db.query.staffAssignments.findFirst({
      where: and(
        eq(staffAssignments.gymId, gymId),
        eq(staffAssignments.userId, domainUserId),
        eq(staffAssignments.role, 'owner'),
        eq(staffAssignments.isActive, true),
      ),
    });

    if (!ownership) {
      throw new BadRequestException({
        code: 'FORBIDDEN',
        message: 'Only the gym owner may resubmit this gym for verification',
      });
    }

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });

    if (!gym) {
      throw new BadRequestException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Gym not found',
      });
    }

    if (gym.status !== 'rejected') {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Only rejected gyms can be resubmitted. Current status is '${gym.status}'`,
      });
    }

    const [updated] = await this.db
      .update(gyms)
      .set({
        status: 'pending_verification',
        updatedAt: new Date(),
      })
      .where(eq(gyms.id, gymId))
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: domainUserId,
      actorRole: 'owner',
      action: 'gym.resubmit',
      entityType: 'gym',
      entityId: gymId,
      payload: {
        previousStatus: 'rejected',
        newStatus: 'pending_verification',
      },
    });

    return updated;
  }

  /**
   * Upload / register verification document for gym (allowed while pending verification)
   */
  async uploadGymDocument(
    gymId: string,
    input: {
      docType: 'trade_license' | 'trn_certificate' | 'id_card' | 'other';
      fileName: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
    },
    actorUserId?: string,
  ) {
    if (!input.docType || !input.fileName || !input.storageKey) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'docType, fileName, and storageKey are required for document registration',
      });
    }

    const [doc] = await this.db
      .insert(gymDocuments)
      .values({
        gymId,
        docType: input.docType,
        fileName: input.fileName,
        storageKey: input.storageKey,
        mimeType: input.mimeType || 'application/pdf',
        sizeBytes: Number(input.sizeBytes) || 0,
        uploadedBy: isUuidString(actorUserId) ? actorUserId : null,
      })
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'gym.document_uploaded',
      entityType: 'gym_document',
      entityId: doc.id,
      payload: {
        docType: doc.docType,
        fileName: doc.fileName,
      },
    });

    return doc;
  }

  /**
   * List all verification documents uploaded for a gym
   */
  async getGymDocuments(gymId: string) {
    return this.db.query.gymDocuments.findMany({
      where: scopeToGym(gymDocuments, gymId),
    });
  }

  /**
   * Set or update manager PIN for step-up authorizations
   * Rejects trivial PINs, hashes with scrypt, resets lockouts, and records audit inside transaction.
   */
  async setManagerPin(gymId: string, actorUserId: string, rawInput: unknown) {
    const parseResult = setManagerPinSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parseResult.error.issues[0]?.message || 'Invalid manager PIN',
        errors: parseResult.error.issues,
      });
    }

    const { pin } = parseResult.data;
    const pinHash = await hashPin(pin);

    return await this.db.transaction(async (tx) => {
      // Find domain user id if actorUserId might be authUserId or domain userId
      let domainUserId = actorUserId;
      const userRow = await tx.query.users.findFirst({
        where: or(eq(users.id, actorUserId), eq(users.authUserId, actorUserId)),
      });
      if (userRow) {
        domainUserId = userRow.id;
      }

      // Verify caller is active owner or manager of this gym
      const staff = await tx.query.staffAssignments.findFirst({
        where: and(
          eq(staffAssignments.gymId, gymId),
          eq(staffAssignments.userId, domainUserId),
          eq(staffAssignments.isActive, true),
        ),
      });

      if (!staff || (staff.role !== 'owner' && staff.role !== 'manager')) {
        throw new BadRequestException({
          code: 'UNAUTHORIZED_MANAGER_PIN',
          message: 'Only active owners or managers of this gym can configure a manager PIN',
        });
      }

      // Check existing PIN record
      const existing = await tx.query.managerPins.findFirst({
        where: and(
          eq(managerPins.gymId, gymId),
          eq(managerPins.userId, domainUserId),
        ),
      });

      let pinRecordId: string;
      if (existing) {
        const [updated] = await tx
          .update(managerPins)
          .set({
            pinHash,
            failedAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(managerPins.id, existing.id))
          .returning();
        pinRecordId = updated.id;
      } else {
        const [inserted] = await tx
          .insert(managerPins)
          .values({
            gymId,
            userId: domainUserId,
            pinHash,
            failedAttempts: 0,
            lockedUntil: null,
          })
          .returning();
        pinRecordId = inserted.id;
      }

      // Fail-closed audit log inside business transaction (PIN / hash is NEVER logged)
      await this.auditService.log(
        {
          gymId,
          actorUserId: domainUserId,
          actorRole: staff.role,
          action: 'manager_pin.update',
          entityType: 'manager_pin',
          entityId: pinRecordId,
          payload: {
            updated: !!existing,
          },
        },
        tx,
      );

      return {
        success: true,
        message: 'Manager PIN configured successfully',
      };
    });
  }

  /**
   * Verify SHA-256 chain integrity for this gym
   */
  async verifyAuditChain(gymId: string) {
    return await this.auditService.verifyChainIntegrity(gymId);
  }
}
