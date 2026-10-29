import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
  authUsers,
  branches,
  gymDocuments,
  gymPaymentAccounts,
  gyms,
  staffAssignments,
  staffBranchAccess,
  users,
} from '../db/schema';
import {
  createGymSchema,
  type CreateGymInput,
  assignStaffSchema,
  type AssignStaffInput,
} from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { encryptAes256Gcm } from '../common/crypto/aes-gcm';
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
          (i: { path: (string | number)[]; message: string }) => ({
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

    // Cap: A user may create and own only one gym during Phase 1
    const existingOwnership = await this.db.query.staffAssignments.findFirst({
      where: and(
        eq(staffAssignments.userId, domainUser.id),
        eq(staffAssignments.role, 'owner'),
        eq(staffAssignments.isActive, true),
      ),
    });

    if (existingOwnership) {
      throw new BadRequestException({
        code: 'GYM_CREATION_LIMIT_EXCEEDED',
        message: 'A user may only create and own one gym during Phase 1',
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

      return {
        gym: newGym,
        defaultBranch,
        staffAssignment: assignment,
      };
    });

    // 4. Append tamper-evident audit record
    await this.auditService.log({
      gymId: result.gym.id,
      actorUserId: domainUser.id,
      action: 'gym.create',
      entityType: 'gym',
      entityId: result.gym.id,
      payload: {
        legalName: result.gym.legalName,
        tradeName: result.gym.tradeName,
        currency: result.gym.currency,
      },
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

    return rows;
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
   * List all active staff assigned to this gym
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
        },
      })
      .from(staffAssignments)
      .innerJoin(users, eq(staffAssignments.userId, users.id))
      .where(
        scopeToGym(
          staffAssignments,
          gymId,
          eq(staffAssignments.isActive, true),
        ),
      );

    return staff;
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
          (i: { path: (string | number)[]; message: string }) => ({
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
        where: eq(authUsers.email, input.email),
      });
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
            fullName: authUser.name || 'Staff Member',
            nameSearch: (authUser.name || 'Staff Member').toLowerCase(),
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

    // Record audit trail
    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'staff.assign',
      entityType: 'staff_assignment',
      entityId: result.assignmentId,
      payload: {
        targetUserId: resolvedUserId,
        role: input.role,
        branchScope: input.branchScope,
      },
    });

    return result;
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
   * Verify SHA-256 chain integrity
   */
  async verifyAuditChain() {
    return await this.auditService.verifyChainIntegrity();
  }
}
