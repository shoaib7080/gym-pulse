import { formatDateOnly } from '@gympulse/shared';

/**
 * Canonical helper for Gym local calendar dates (YYYY-MM-DD).
 * Resolves the exact business calendar date in the gym's timezone.
 * Critical between 20:00 UTC and 04:00 UTC where UTC and local dates diverge.
 * E.g., 23:30 UTC on Oct 26 is 03:30 AM on Oct 27 in Asia/Dubai.
 */
export function getGymLocalDate(
  timeZone: string = 'Asia/Dubai',
  referenceDate: Date = new Date(),
): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(referenceDate);
  } catch {
    return formatDateOnly(referenceDate);
  }
}
