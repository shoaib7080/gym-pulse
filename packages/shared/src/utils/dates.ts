/**
 * Business date utilities for GymPulse (inclusive date logic in gym local timezone)
 *
 * Implements Step 6 of Hardening Guide:
 * Month-end inclusive date arithmetic utilizing date-fns for calendar month calculations.
 */

import { getDaysInMonth } from 'date-fns';

export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date string: ${dateStr}. Expected YYYY-MM-DD`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Canonical helper for Gym local calendar dates (YYYY-MM-DD).
 * Resolves the exact business calendar date in the gym's timezone.
 * Critical between 20:00 UTC and 04:00 UTC where UTC and local dates diverge.
 */
export function getGymLocalDate(timeZone: string = 'Asia/Dubai', referenceDate: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(referenceDate);
  } catch {
    return formatDateOnly(referenceDate);
  }
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the specified timezone
 */
export function getTodayInTimezone(timeZone: string = 'Asia/Dubai'): string {
  return getGymLocalDate(timeZone);
}

/**
 * Calculates the inclusive day count between start and end date (both inclusive).
 * N = end_date - start_date + 1
 */
export function calculateInclusiveDays(startDateStr: string, endDateStr: string): number {
  const start = parseDateOnly(startDateStr);
  const end = parseDateOnly(endDateStr);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

/**
 * Add days to a YYYY-MM-DD date string using pure UTC arithmetic
 */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date string: ${dateStr}. Expected YYYY-MM-DD`);
  }
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatDateOnly(date);
}

/**
 * Adds months to a YYYY-MM-DD date string with clamping.
 * target = start plus n months.
 * If the start day does not exist in the target month (e.g. 31 Jan + 1 mo in Feb 2026),
 * the day is clamped to the last day of the target month.
 */
export function addMonthsClamped(dateStr: string, months: number): string {
  const [startY, startM, startD] = dateStr.split('-').map(Number);
  if (!startY || !startM || !startD) {
    throw new Error(`Invalid date string: ${dateStr}. Expected YYYY-MM-DD`);
  }

  const totalMonths = (startY * 12 + (startM - 1)) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12;
  const targetMonth = targetMonthIndex + 1;

  // Use date-fns getDaysInMonth for battle-tested calendar lengths
  const maxDaysInTarget = getDaysInMonth(new Date(targetYear, targetMonthIndex, 1));
  const targetDay = Math.min(startD, maxDaysInTarget);

  const y = String(targetYear).padStart(4, '0');
  const m = String(targetMonth).padStart(2, '0');
  const d = String(targetDay).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes inclusive membership end date:
 * - Units:
 *   - 'day': end = start + value - 1 days
 *   - 'month':
 *       target = start plus n months.
 *       If start day did not exist in target month (clamping happened),
 *         end = last day of target month (e.g., 31 Jan, 1 month ends 28 Feb 2026; 30 Jan ends 28 Feb 2026; 31 Mar ends 30 Apr).
 *       If start day existed in target month (no clamping),
 *         end = target minus 1 day (e.g., 15 Jan, 1 month ends 14 Feb; 28 Feb, 1 month ends 27 Mar).
 *   - 'year': 12 months per year (e.g., 29 Feb 2028 for 12 months ends 28 Feb 2029; 28 Feb 2027 ends 27 Feb 2028).
 */
export function computeInclusiveEndDate(
  startDateStr: string,
  unit: 'day' | 'month' | 'year' | string,
  value: number,
): string {
  if (value <= 0) {
    throw new Error(`Duration value must be positive, got ${value}`);
  }

  if (unit === 'day') {
    return addDays(startDateStr, value - 1);
  }

  const months = unit === 'year' ? value * 12 : value;
  if (unit === 'month' || unit === 'year') {
    const [startY, startM, startD] = startDateStr.split('-').map(Number);
    if (!startY || !startM || !startD) {
      throw new Error(`Invalid date string: ${startDateStr}. Expected YYYY-MM-DD`);
    }

    const totalMonths = (startY * 12 + (startM - 1)) + months;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonthIndex = ((totalMonths % 12) + 12) % 12;
    const targetMonth = targetMonthIndex + 1;

    // Use date-fns getDaysInMonth
    const maxDaysInTarget = getDaysInMonth(new Date(targetYear, targetMonthIndex, 1));
    const wasClamped = startD > maxDaysInTarget;

    if (wasClamped) {
      // Clamping happened: end is the last day of target month
      const y = String(targetYear).padStart(4, '0');
      const m = String(targetMonth).padStart(2, '0');
      const d = String(maxDaysInTarget).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else {
      // No clamping: target is targetYear-targetMonth-startD, end = target - 1 day
      const targetStr = `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(startD).padStart(2, '0')}`;
      return addDays(targetStr, -1);
    }
  }

  throw new Error(`Unsupported duration unit: ${unit}. Supported units: 'day', 'month', 'year'`);
}

export interface FreezeMathResult {
  requestedDays: number;
  daysUsed?: number;
  daysCharged: number;
  daysReturned: number;
  projectedEndDate: string;
}

/**
 * Calculate freeze date mathematics according to Spec Section 7.4:
 *
 * Let S be first frozen day, E last frozen day (inclusive), N = E - S + 1
 * Early lift: Let A be the day member returns. days_used = A - S.
 * days_charged = min(N, max(days_used, min_days))
 * days_returned = N - days_charged
 * new_end_date = current_end_date + days_charged
 */
export function calculateFreezeMath(params: {
  currentEndDate: string;
  startDate: string;
  endDate: string;
  minDays?: number;
  earlyReturnDate?: string;
}): FreezeMathResult {
  const { currentEndDate, startDate, endDate, minDays = 7, earlyReturnDate } = params;
  const N = calculateInclusiveDays(startDate, endDate);

  if (!earlyReturnDate) {
    // Full run
    return {
      requestedDays: N,
      daysCharged: N,
      daysReturned: 0,
      projectedEndDate: addDays(currentEndDate, N),
    };
  }

  // Early lift
  // days_used = A - S (days the member was actually frozen before returning)
  const start = parseDateOnly(startDate);
  const ret = parseDateOnly(earlyReturnDate);
  const daysUsed = Math.max(0, Math.round((ret.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const daysCharged = Math.min(N, Math.max(daysUsed, minDays));
  const daysReturned = N - daysCharged;
  const projectedEndDate = addDays(currentEndDate, daysCharged);

  return {
    requestedDays: N,
    daysUsed,
    daysCharged,
    daysReturned,
    projectedEndDate,
  };
}
