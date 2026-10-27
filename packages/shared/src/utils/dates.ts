/**
 * Business date utilities for GymPulse (inclusive date logic in gym local timezone)
 */

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
 * Add days to a YYYY-MM-DD date string
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseDateOnly(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
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
