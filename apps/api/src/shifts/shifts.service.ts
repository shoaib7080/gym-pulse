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

    const [closedShift] = await this.db
      .update(shifts)
      .set({
        closedAt: new Date(),
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
      },
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
