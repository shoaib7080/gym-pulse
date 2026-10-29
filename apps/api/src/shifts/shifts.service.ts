import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import { branches, gyms, payments, shifts, users } from '../db/schema';
import {
  openShiftSchema,
  type OpenShiftInput,
  closeShiftSchema,
  type CloseShiftInput,
  approveVarianceSchema,
  type ApproveVarianceInput,
} from '@gympulse/shared';
import { AuditService } from '../common/audit/audit.service';
import { scopeEntityToGym, scopeToGym } from '../common/tenant/tenant-scope.helper';

@Injectable()
export class ShiftsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Open a cashier shift with opening cash float
   */
  async openShift(gymId: string, userId: string, rawInput: unknown) {
    const parseResult = openShiftSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid shift opening data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: OpenShiftInput = parseResult.data;

    // Verify branch belongs to gym
    const branch = await this.db.query.branches.findFirst({
      where: scopeEntityToGym(branches, gymId, input.branchId),
    });

    if (!branch) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Specified branchId is invalid or belongs to another gym',
      });
    }

    // Verify user doesn't already have an open shift
    const existingOpenShift = await this.db.query.shifts.findFirst({
      where: scopeToGym(
        shifts,
        gymId,
        and(eq(shifts.openedBy, userId), isNull(shifts.closedAt)),
      ),
    });

    if (existingOpenShift) {
      throw new ConflictException({
        code: 'SHIFT_ALREADY_OPEN',
        message: 'You already have an open shift. Please close your active shift before opening a new one.',
      });
    }

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const currency = input.currency || gym?.currency || 'AED';

    const [newShift] = await this.db
      .insert(shifts)
      .values({
        gymId,
        branchId: input.branchId,
        openedBy: userId,
        openingFloatMinor: Number(input.openingFloatMinor ?? 0n),
        currency,
      })
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: userId,
      action: 'shift.open',
      entityType: 'shift',
      entityId: newShift.id,
      payload: {
        branchId: newShift.branchId,
        openingFloatMinor: newShift.openingFloatMinor,
      },
    });

    return newShift;
  }

  /**
   * Get the active open shift for the current staff member
   */
  async getCurrentShift(gymId: string, userId: string) {
    const current = await this.db.query.shifts.findFirst({
      where: scopeToGym(
        shifts,
        gymId,
        and(eq(shifts.openedBy, userId), isNull(shifts.closedAt)),
      ),
    });

    return current ?? null;
  }

  /**
   * Close a cashier shift with blind cash reconciliation
   */
  async closeShift(
    gymId: string,
    shiftId: string,
    userId: string,
    rawInput: unknown,
  ) {
    const parseResult = closeShiftSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid shift closing data',
        invalidParams: parseResult.error.issues.map(
          (i: { path: (string | number)[]; message: string }) => ({
            name: i.path.join('.'),
            reason: i.message,
          }),
        ),
      });
    }

    const input: CloseShiftInput = parseResult.data;

    const shift = await this.db.query.shifts.findFirst({
      where: scopeEntityToGym(shifts, gymId, shiftId),
    });

    if (!shift) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Shift not found',
      });
    }

    if (shift.closedAt) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'This shift has already been closed',
      });
    }

    // Sum all cash payments during this shift strictly scoped to this gym
    const [cashTotals] = await this.db
      .select({
        totalCashSales: sql<number>`COALESCE(SUM(${payments.totalMinor}), 0)::bigint`,
      })
      .from(payments)
      .where(
        scopeToGym(
          payments,
          gymId,
          and(
            eq(payments.shiftId, shiftId),
            eq(payments.method, 'cash'),
            eq(payments.status, 'succeeded'),
          ),
        ),
      );

    const cashSalesMinor = Number(cashTotals?.totalCashSales || 0);
    const expectedCashMinor = shift.openingFloatMinor + cashSalesMinor;
    const countedCashMinor = Number(input.countedCashMinor);
    const varianceMinor = countedCashMinor - expectedCashMinor;

    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const toleranceMinor = (gym?.settings as any)?.cashToleranceMinor ?? 0;
    const requiresApproval = Math.abs(varianceMinor) > toleranceMinor;
    const finalStatus = requiresApproval ? 'variance_pending' : 'closed';

    const [closedShift] = await this.db
      .update(shifts)
      .set({
        closedBy: userId,
        closedAt: new Date(),
        cashSalesMinor,
        expectedCashMinor,
        countedCashMinor,
        varianceMinor,
        status: finalStatus,
      })
      .where(scopeEntityToGym(shifts, gymId, shiftId))
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId: userId,
      action: 'shift.close',
      entityType: 'shift',
      entityId: shiftId,
      payload: {
        openingFloatMinor: shift.openingFloatMinor,
        cashSalesMinor,
        expectedCashMinor,
        countedCashMinor,
        varianceMinor,
        status: finalStatus,
        requiresApproval,
        notes: input.notes ?? null,
      },
    });

    return {
      shift: closedShift,
      reconciliation: {
        openingFloatMinor: shift.openingFloatMinor,
        cashSalesMinor,
        expectedCashMinor,
        countedCashMinor,
        varianceMinor,
        hasDiscrepancy: varianceMinor !== 0,
        requiresApproval,
        status: finalStatus,
      },
    };
  }

  /**
   * Approve a shift closeout variance (Owner or Manager only)
   * Enforces:
   * 1. Shift must be closed
   * 2. Segregation of duties: Cashier cannot approve their own shift variance
   * 3. Cryptographic audit trail logging
   */
  async approveShiftVariance(
    gymId: string,
    shiftId: string,
    actorUserId: string,
    actorRole: string,
    rawInput: unknown,
  ) {
    const parseResult = approveVarianceSchema.safeParse(rawInput || {});
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid approval data',
      });
    }
    const input: ApproveVarianceInput = parseResult.data;

    const shift = await this.db.query.shifts.findFirst({
      where: scopeEntityToGym(shifts, gymId, shiftId),
    });

    if (!shift) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Shift not found',
      });
    }

    if (!shift.closedAt) {
      throw new BadRequestException({
        code: 'SHIFT_NOT_CLOSED',
        message: 'Cannot approve an open shift. Shift must be closed first.',
      });
    }

    if (shift.status === 'approved') {
      return {
        shift,
        message: 'Shift variance has already been approved',
      };
    }

    // Spec Requirement: Segregation of duties - cashier cannot approve their own shift variance
    if (shift.openedBy === actorUserId || shift.closedBy === actorUserId) {
      throw new BadRequestException({
        code: 'SELF_APPROVAL_PROHIBITED',
        message: 'Staff cannot approve their own shift variance',
      });
    }

    const [updatedShift] = await this.db
      .update(shifts)
      .set({
        status: 'approved',
        approvedBy: actorUserId,
        approvedAt: new Date(),
        approvalNotes: input.notes || null,
      })
      .where(scopeEntityToGym(shifts, gymId, shiftId))
      .returning();

    await this.auditService.log({
      gymId,
      actorUserId,
      action: 'shift.variance_approved',
      entityType: 'shift',
      entityId: shift.id,
      payload: {
        varianceMinor: shift.varianceMinor,
        approvedBy: actorUserId,
        authorizingRole: actorRole,
        notes: input.notes || null,
      },
    });

    return {
      shift: updatedShift,
      approval: {
        approvedBy: actorUserId,
        approvedAt: updatedShift.approvedAt,
        notes: input.notes || null,
      },
    };
  }

  /**
   * List shifts for gym with filters
   */
  async listShifts(
    gymId: string,
    options: {
      branchId?: string;
      status?: string;
      openedBy?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const conditions = [eq(shifts.gymId, gymId)];
    if (options.branchId) {
      conditions.push(eq(shifts.branchId, options.branchId));
    }
    if (options.status) {
      conditions.push(eq(shifts.status, options.status as any));
    }
    if (options.openedBy) {
      conditions.push(eq(shifts.openedBy, options.openedBy));
    }

    const items = await this.db.query.shifts.findMany({
      where: and(...conditions),
      orderBy: [desc(shifts.openedAt)],
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    });

    return {
      items,
      total: items.length,
    };
  }

  /**
   * Get shift details with payment summary
   */
  async getShiftById(gymId: string, shiftId: string) {
    const shift = await this.db.query.shifts.findFirst({
      where: scopeEntityToGym(shifts, gymId, shiftId),
    });

    if (!shift) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Shift not found',
      });
    }

    const shiftPayments = await this.db.query.payments.findMany({
      where: scopeToGym(payments, gymId, eq(payments.shiftId, shiftId)),
      orderBy: [desc(payments.createdAt)],
    });

    const staffUser = await this.db.query.users.findFirst({
      where: eq(users.id, shift.openedBy),
    });

    return {
      ...shift,
      openedByStaff: staffUser,
      payments: shiftPayments,
    };
  }
}
