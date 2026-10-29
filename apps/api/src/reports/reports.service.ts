import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module';
import {
  checkIns,
  gyms,
  members,
  membershipAdjustments,
  memberships,
  payments,
  shifts,
  users,
} from '../db/schema';
import { AuditService } from '../common/audit/audit.service';
import { getGymLocalDate } from '../common/utils/dates';

export interface AnomalyReportFilters {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  staffUserId?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Automated anomaly detection per staff member (Spec Section 8 & Milestone 4)
   * Tracks:
   * 1. Cashier shift closeout variances
   * 2. Complimentary membership extensions (unearned free time)
   * 3. Payment voids and refunds
   * 4. Manual check-in overrides
   */
  async getCashAndAuditAnomalies(
    gymId: string,
    filters: AnomalyReportFilters = {},
    actorUserId?: string,
  ) {
    const gym = await this.db.query.gyms.findFirst({
      where: eq(gyms.id, gymId),
    });
    const today = getGymLocalDate(gym?.timezone || 'Asia/Dubai');

    // 1. Shift Variances
    const shiftConditions = [
      eq(shifts.gymId, gymId),
      sql`${shifts.varianceMinor} IS NOT NULL AND ${shifts.varianceMinor} != 0`,
    ];
    if (filters.branchId) {
      shiftConditions.push(eq(shifts.branchId, filters.branchId));
    }
    if (filters.staffUserId) {
      shiftConditions.push(
        sql`(${shifts.openedBy} = ${filters.staffUserId} OR ${shifts.closedBy} = ${filters.staffUserId})`,
      );
    }

    const shiftVariances = await this.db.query.shifts.findMany({
      where: and(...shiftConditions),
      orderBy: [desc(shifts.closedAt)],
    });

    // 2. Complimentary Term Extensions
    const compConditions = [
      eq(membershipAdjustments.gymId, gymId),
      eq(membershipAdjustments.kind, 'complimentary'),
    ];
    if (filters.staffUserId) {
      compConditions.push(eq(membershipAdjustments.createdBy, filters.staffUserId));
    }

    const complimentaryExtensions = await this.db.query.membershipAdjustments.findMany({
      where: and(...compConditions),
      orderBy: [desc(membershipAdjustments.createdAt)],
    });

    // 3. Voided / Refunded Payments
    const voidConditions = [
      eq(payments.gymId, gymId),
      inArray(payments.status, ['voided', 'refunded']),
    ];
    if (filters.branchId) {
      voidConditions.push(eq(payments.branchId, filters.branchId));
    }
    if (filters.staffUserId) {
      voidConditions.push(eq(payments.recordedBy, filters.staffUserId));
    }

    const voidedPayments = await this.db.query.payments.findMany({
      where: and(...voidConditions),
      orderBy: [desc(payments.createdAt)],
    });

    // 4. Manual Check-in Overrides
    const overrideConditions = [
      eq(checkIns.gymId, gymId),
      eq(checkIns.result, 'override_allowed'),
    ];
    if (filters.branchId) {
      overrideConditions.push(eq(checkIns.branchId, filters.branchId));
    }
    if (filters.staffUserId) {
      overrideConditions.push(eq(checkIns.verifiedBy, filters.staffUserId));
    }

    const manualOverrides = await this.db.query.checkIns.findMany({
      where: and(...overrideConditions),
      orderBy: [desc(checkIns.createdAt)],
    });

    // Collect all relevant staff IDs
    const staffIdSet = new Set<string>();
    shiftVariances.forEach((s) => {
      if (s.closedBy) staffIdSet.add(s.closedBy);
      if (s.openedBy) staffIdSet.add(s.openedBy);
    });
    complimentaryExtensions.forEach((c) => {
      if (c.createdBy) staffIdSet.add(c.createdBy);
    });
    voidedPayments.forEach((v) => {
      if (v.recordedBy) staffIdSet.add(v.recordedBy);
    });
    manualOverrides.forEach((m) => {
      if (m.verifiedBy) staffIdSet.add(m.verifiedBy);
    });

    // Load staff user profiles
    const staffIds = Array.from(staffIdSet);
    const staffUsers =
      staffIds.length > 0
        ? await this.db.query.users.findMany({
            where: inArray(users.id, staffIds),
          })
        : [];
    const staffMap = new Map(staffUsers.map((u) => [u.id, u.fullName || u.email || 'Staff']));

    // Build per-staff anomaly profiles
    const staffProfileMap = new Map<
      string,
      {
        staffUserId: string;
        staffName: string;
        varianceCount: number;
        totalVarianceMinor: number;
        unapprovedVarianceCount: number;
        complimentaryCount: number;
        voidCount: number;
        overrideCount: number;
        flags: string[];
      }
    >();

    const getOrCreateProfile = (uId: string) => {
      if (!staffProfileMap.has(uId)) {
        staffProfileMap.set(uId, {
          staffUserId: uId,
          staffName: staffMap.get(uId) || 'Unknown Staff',
          varianceCount: 0,
          totalVarianceMinor: 0,
          unapprovedVarianceCount: 0,
          complimentaryCount: 0,
          voidCount: 0,
          overrideCount: 0,
          flags: [],
        });
      }
      return staffProfileMap.get(uId)!;
    };

    shiftVariances.forEach((s) => {
      const uId = s.closedBy || s.openedBy;
      if (!uId) return;
      const prof = getOrCreateProfile(uId);
      prof.varianceCount++;
      prof.totalVarianceMinor += s.varianceMinor || 0;
      if (s.status === 'variance_pending') {
        prof.unapprovedVarianceCount++;
      }
    });

    complimentaryExtensions.forEach((c) => {
      if (!c.createdBy) return;
      const prof = getOrCreateProfile(c.createdBy);
      prof.complimentaryCount++;
    });

    voidedPayments.forEach((v) => {
      if (!v.recordedBy) return;
      const prof = getOrCreateProfile(v.recordedBy);
      prof.voidCount++;
    });

    manualOverrides.forEach((m) => {
      if (!m.verifiedBy) return;
      const prof = getOrCreateProfile(m.verifiedBy);
      prof.overrideCount++;
    });

    // Apply anomaly flags
    for (const prof of staffProfileMap.values()) {
      if (prof.unapprovedVarianceCount > 0) {
        prof.flags.push('UNAPPROVED_VARIANCE_PENDING');
      }
      if (Math.abs(prof.totalVarianceMinor) > 10000) {
        // > 100 AED variance
        prof.flags.push('HIGH_DRAWER_VARIANCE');
      }
      if (prof.complimentaryCount >= 3) {
        prof.flags.push('FREQUENT_COMPLIMENTARY_GRANTS');
      }
      if (prof.voidCount >= 3) {
        prof.flags.push('FREQUENT_PAYMENT_VOIDS');
      }
      if (prof.overrideCount >= 5) {
        prof.flags.push('HIGH_CHECK_IN_OVERRIDES');
      }
    }

    const netVarianceMinor = shiftVariances.reduce(
      (sum, s) => sum + (s.varianceMinor || 0),
      0,
    );
    const unapprovedVariances = shiftVariances.filter(
      (s) => s.status === 'variance_pending',
    ).length;

    // Append report view to audit log
    await this.auditService.log({
      gymId,
      actorUserId: actorUserId ?? null,
      action: 'report.anomalies_generated',
      entityType: 'report',
      payload: {
        totalShiftsWithVariance: shiftVariances.length,
        unapprovedVariances,
        netVarianceMinor,
        totalComplimentary: complimentaryExtensions.length,
        totalVoids: voidedPayments.length,
        totalOverrides: manualOverrides.length,
        today,
      },
    });

    return {
      summary: {
        totalShiftsWithVariance: shiftVariances.length,
        unapprovedVariances,
        netVarianceMinor,
        totalComplimentaryExtensions: complimentaryExtensions.length,
        totalVoidedPayments: voidedPayments.length,
        totalManualOverrides: manualOverrides.length,
        asOfDate: today,
      },
      staffBreakdown: Array.from(staffProfileMap.values()),
      details: {
        shiftVariances: shiftVariances.map((s) => ({
          shiftId: s.id,
          branchId: s.branchId,
          openedBy: s.openedBy,
          closedBy: s.closedBy,
          staffName: staffMap.get(s.closedBy || s.openedBy) || 'Staff',
          openingFloatMinor: s.openingFloatMinor,
          cashSalesMinor: s.cashSalesMinor,
          expectedCashMinor: s.expectedCashMinor,
          countedCashMinor: s.countedCashMinor,
          varianceMinor: s.varianceMinor,
          status: s.status,
          approvedBy: s.approvedBy,
          approvedAt: s.approvedAt,
          closedAt: s.closedAt,
        })),
        complimentaryExtensions: complimentaryExtensions.map((c) => ({
          adjustmentId: c.id,
          membershipId: c.membershipId,
          createdBy: c.createdBy,
          staffName: c.createdBy ? staffMap.get(c.createdBy) || 'Staff' : 'System',
          previousEndDate: c.previousEndDate,
          newEndDate: c.newEndDate,
          reason: c.reason,
          createdAt: c.createdAt,
        })),
        voidedPayments: voidedPayments.map((v) => ({
          paymentId: v.id,
          recordedBy: v.recordedBy,
          staffName: v.recordedBy ? staffMap.get(v.recordedBy) || 'Staff' : 'System',
          totalMinor: v.totalMinor,
          method: v.method,
          status: v.status,
          voidReason: v.voidReason,
          createdAt: v.createdAt,
        })),
        manualOverrides: manualOverrides.map((m) => ({
          checkInId: m.id,
          memberId: m.memberId,
          membershipId: m.membershipId,
          verifiedBy: m.verifiedBy,
          staffName: m.verifiedBy ? staffMap.get(m.verifiedBy) || 'Staff' : 'Staff',
          overrideReason: m.overrideReason,
          createdAt: m.createdAt,
        })),
      },
    };
  }

  /**
   * Executive Revenue Reporting (Spec Section 8.6 & Milestone 6)
   * Aggregates gross sales, 5% UAE VAT, net breakdown, and payment methods
   */
  async getRevenueReport(
    gymId: string,
    filters: { startDate?: string; endDate?: string; branchId?: string } = {},
  ) {
    const conditions = [
      eq(payments.gymId, gymId),
      eq(payments.status, 'succeeded'),
    ];

    if (filters.branchId) {
      conditions.push(eq(payments.branchId, filters.branchId));
    }
    if (filters.startDate) {
      conditions.push(gte(payments.createdAt, new Date(`${filters.startDate}T00:00:00Z`)));
    }
    if (filters.endDate) {
      conditions.push(lte(payments.createdAt, new Date(`${filters.endDate}T23:59:59.999Z`)));
    }

    const paymentRows = await this.db.query.payments.findMany({
      where: and(...conditions),
      orderBy: [desc(payments.createdAt)],
    });

    let grossSalesMinor = 0;
    const byMethod: Record<string, { count: number; totalMinor: number }> = {
      cash: { count: 0, totalMinor: 0 },
      pos_card: { count: 0, totalMinor: 0 },
      bank_transfer: { count: 0, totalMinor: 0 },
      payment_link: { count: 0, totalMinor: 0 },
    };

    for (const p of paymentRows) {
      const amount = Number(p.totalMinor);
      grossSalesMinor += amount;

      const methodKey = p.method in byMethod ? p.method : 'other';
      if (!byMethod[methodKey]) {
        byMethod[methodKey] = { count: 0, totalMinor: 0 };
      }
      byMethod[methodKey].count++;
      byMethod[methodKey].totalMinor += amount;
    }

    // 5% UAE VAT computation (Standard tax component: vat = gross - round(gross / 1.05))
    const vatMinor = Math.round(grossSalesMinor - Math.round(grossSalesMinor / 1.05));
    const netSalesMinor = grossSalesMinor - vatMinor;

    return {
      period: {
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
        branchId: filters.branchId || null,
      },
      summary: {
        grossSalesMinor,
        vatMinor,
        netSalesMinor,
        vatRatePercent: 5,
        currency: 'AED',
        transactionCount: paymentRows.length,
      },
      byMethod,
    };
  }

  /**
   * Check-in Analytics & Heatmap Reporting (Spec Section 8.6 & Milestone 6)
   * Aggregates hourly peak distribution, allow/deny ratios, and transport methods
   */
  async getCheckInsReport(
    gymId: string,
    filters: { startDate?: string; endDate?: string; branchId?: string } = {},
  ) {
    const conditions = [eq(checkIns.gymId, gymId)];

    if (filters.branchId) {
      conditions.push(eq(checkIns.branchId, filters.branchId));
    }
    if (filters.startDate) {
      conditions.push(gte(checkIns.createdAt, new Date(`${filters.startDate}T00:00:00Z`)));
    }
    if (filters.endDate) {
      conditions.push(lte(checkIns.createdAt, new Date(`${filters.endDate}T23:59:59.999Z`)));
    }

    const rows = await this.db.query.checkIns.findMany({
      where: and(...conditions),
      orderBy: [desc(checkIns.createdAt)],
    });

    const hourlyDistribution: { hour: number; label: string; count: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const label = `${String(h).padStart(2, '0')}:00`;
      hourlyDistribution.push({ hour: h, label, count: 0 });
    }

    let allowedCount = 0;
    let deniedCount = 0;
    let overrideCount = 0;

    const byMethod: Record<string, number> = {
      qr: 0,
      desk_search: 0,
      manual: 0,
      turnstile: 0,
      self_tap_temporary: 0,
    };

    for (const r of rows) {
      if (r.result === 'allowed') allowedCount++;
      else if (r.result === 'denied') deniedCount++;
      else if (r.result === 'override_allowed') overrideCount++;

      if (r.method in byMethod) {
        byMethod[r.method]++;
      } else {
        byMethod[r.method] = 1;
      }

      // Compute hour in UAE time (UTC+4)
      const d = new Date(r.createdAt);
      // UTC + 4 hours
      const uaeHour = (d.getUTCHours() + 4) % 24;
      if (hourlyDistribution[uaeHour]) {
        hourlyDistribution[uaeHour].count++;
      }
    }

    return {
      period: {
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
        branchId: filters.branchId || null,
      },
      summary: {
        totalCheckIns: rows.length,
        allowedCount,
        deniedCount,
        overrideCount,
        allowRatePercent: rows.length > 0 ? Math.round((allowedCount / rows.length) * 100) : 0,
      },
      byMethod,
      hourlyDistribution,
    };
  }

  /**
   * Manual Term Adjustments & Staff Correction Logs (Spec Section 8.6 & Milestone 6)
   * Tracks unearned complimentary extensions vs system corrections
   */
  async getManualAdjustmentsReport(
    gymId: string,
    filters: { startDate?: string; endDate?: string; staffUserId?: string } = {},
  ) {
    const conditions = [eq(membershipAdjustments.gymId, gymId)];

    if (filters.staffUserId) {
      conditions.push(eq(membershipAdjustments.createdBy, filters.staffUserId));
    }
    if (filters.startDate) {
      conditions.push(gte(membershipAdjustments.createdAt, new Date(`${filters.startDate}T00:00:00Z`)));
    }
    if (filters.endDate) {
      conditions.push(lte(membershipAdjustments.createdAt, new Date(`${filters.endDate}T23:59:59.999Z`)));
    }

    const adjustments = await this.db.query.membershipAdjustments.findMany({
      where: and(...conditions),
      orderBy: [desc(membershipAdjustments.createdAt)],
    });

    const staffIds = new Set<string>();
    for (const adj of adjustments) {
      if (adj.createdBy) staffIds.add(adj.createdBy);
    }

    const staffUsers = staffIds.size > 0
      ? await this.db.query.users.findMany({
          where: inArray(users.id, Array.from(staffIds)),
          columns: { id: true, fullName: true, email: true },
        })
      : [];

    const staffMap = new Map(staffUsers.map((s) => [s.id, s.fullName]));

    let complimentaryDaysTotal = 0;
    let correctionDaysTotal = 0;

    const list = adjustments.map((adj) => {
      const prevDate = new Date(`${adj.previousEndDate}T00:00:00Z`).getTime();
      const newDate = new Date(`${adj.newEndDate}T00:00:00Z`).getTime();
      const daysDiff = Math.round((newDate - prevDate) / (1000 * 60 * 60 * 24));

      if (adj.kind === 'complimentary') {
        complimentaryDaysTotal += Math.max(0, daysDiff);
      } else {
        correctionDaysTotal += Math.max(0, daysDiff);
      }

      return {
        id: adj.id,
        membershipId: adj.membershipId,
        kind: adj.kind,
        previousEndDate: adj.previousEndDate,
        newEndDate: adj.newEndDate,
        daysAdded: daysDiff,
        reason: adj.reason,
        createdBy: adj.createdBy,
        staffName: adj.createdBy ? staffMap.get(adj.createdBy) || 'Staff' : 'System',
        createdAt: adj.createdAt,
      };
    });

    return {
      summary: {
        totalAdjustments: adjustments.length,
        complimentaryDaysTotal,
        correctionDaysTotal,
      },
      adjustments: list,
    };
  }
}
