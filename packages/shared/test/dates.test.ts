import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fc from 'fast-check';
import {
  addMonthsClamped,
  computeInclusiveEndDate,
  calculateInclusiveDays,
  addDays,
} from '../src/utils/dates';

describe('Step 6 Date Math Hardening: Month-End & Inclusive End Dates', () => {
  describe('Table-Driven Guide Test Cases', () => {
    it('1-month plans with month-end clamping and standard offsets', () => {
      // 1-month plans starting in Jan 2026 (non-leap year, Feb has 28 days)
      assert.equal(computeInclusiveEndDate('2026-01-29', 'month', 1), '2026-02-28');
      assert.equal(computeInclusiveEndDate('2026-01-30', 'month', 1), '2026-02-28');
      assert.equal(computeInclusiveEndDate('2026-01-31', 'month', 1), '2026-02-28');

      // 1-month plan starting 01 Feb ends 28 Feb (target 01 March minus 1 day = 28 Feb)
      assert.equal(computeInclusiveEndDate('2026-02-01', 'month', 1), '2026-02-28');

      // 1-month plan starting 28 Feb ends 27 March (28 exists in March, target 28 March minus 1 day = 27 March)
      assert.equal(computeInclusiveEndDate('2026-02-28', 'month', 1), '2026-03-27');

      // 1-month plan starting 31 March (April has 30 days, clamping to last day of April)
      assert.equal(computeInclusiveEndDate('2026-03-31', 'month', 1), '2026-04-30');

      // 1-month plan starting 31 Dec (Jan has 31 days, no clamping, target 31 Jan minus 1 day = 30 Jan)
      assert.equal(computeInclusiveEndDate('2026-12-31', 'month', 1), '2027-01-30');
    });

    it('3-month plan from 2025-11-30', () => {
      // 30 Nov + 3 months -> Feb 2026 (28 days). Clamped to 28 Feb 2026.
      assert.equal(computeInclusiveEndDate('2025-11-30', 'month', 3), '2026-02-28');
    });

    it('12-month / 1-year plans with leap-year boundary handling', () => {
      // Leap day start: 2028-02-29 for 12 months ends 2029-02-28
      assert.equal(computeInclusiveEndDate('2028-02-29', 'month', 12), '2029-02-28');
      assert.equal(computeInclusiveEndDate('2028-02-29', 'year', 1), '2029-02-28');

      // Non-leap to leap year: 2027-02-28 for 12 months ends 2028-02-27 (28 exists in Feb 2028)
      assert.equal(computeInclusiveEndDate('2027-02-28', 'month', 12), '2028-02-27');
      assert.equal(computeInclusiveEndDate('2027-02-28', 'year', 1), '2028-02-27');
    });

    it('30-day and 90-day plans across year ends', () => {
      // 30-day plan across year end: 2025-12-15 + 29 days = 2026-01-13
      const thirtyDayEnd = computeInclusiveEndDate('2025-12-15', 'day', 30);
      assert.equal(thirtyDayEnd, '2026-01-13');
      assert.equal(calculateInclusiveDays('2025-12-15', thirtyDayEnd), 30);

      // 90-day plan across year end: 2025-12-01 + 89 days = 2026-02-28 (non-leap year)
      const ninetyDayEnd = computeInclusiveEndDate('2025-12-01', 'day', 90);
      assert.equal(ninetyDayEnd, '2026-02-28');
      assert.equal(calculateInclusiveDays('2025-12-01', ninetyDayEnd), 90);
    });

    it('1-month plans starting in every month of the year', () => {
      const year = 2026;
      for (let month = 1; month <= 12; month++) {
        const startStr = `${year}-${String(month).padStart(2, '0')}-15`;
        const endStr = computeInclusiveEndDate(startStr, 'month', 1);
        const inclusiveDays = calculateInclusiveDays(startStr, endStr);

        // A 1-month term is always between 28 and 31 days
        assert.ok(
          inclusiveDays >= 28 && inclusiveDays <= 31,
          `Expected 28-31 days for start ${startStr}, got ${inclusiveDays}`,
        );

        // The day before next term's 15th
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const expectedTarget15th = `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`;
        assert.equal(addDays(endStr, 1), expectedTarget15th);
      }
    });

    it('addMonthsClamped behavior', () => {
      // 31 Jan + 1 month in 2026 (Feb has 28 days) -> 2026-02-28
      assert.equal(addMonthsClamped('2026-01-31', 1), '2026-02-28');
      // 31 Jan + 1 month in 2028 (Feb has 29 days) -> 2028-02-29
      assert.equal(addMonthsClamped('2028-01-31', 1), '2028-02-29');
      // 15 Jan + 1 month -> 2026-02-15
      assert.equal(addMonthsClamped('2026-01-15', 1), '2026-02-15');
      // 31 Aug + 1 month (Sep has 30 days) -> 2026-09-30
      assert.equal(addMonthsClamped('2026-08-31', 1), '2026-09-30');
    });
  });

  describe('Property-Based Invariants (fast-check)', () => {
    it('Invariant 1: end >= start for any valid date and positive duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2020, max: 2040 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // valid across all months
          fc.constantFrom('day', 'month', 'year'),
          fc.integer({ min: 1, max: 24 }),
          (year, month, day, unit, value) => {
            const startStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const endStr = computeInclusiveEndDate(startStr, unit, value);
            return endStr >= startStr;
          },
        ),
      );
    });

    it('Invariant 2: 1-month term length is strictly between 28 and 31 days', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2020, max: 2035 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => {
            const startStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const endStr = computeInclusiveEndDate(startStr, 'month', 1);
            const days = calculateInclusiveDays(startStr, endStr);
            return days >= 28 && days <= 31;
          },
        ),
      );
    });

    it('Invariant 3: continuous renewals satisfy next_start = previous_end + 1 day', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2024, max: 2030 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          fc.integer({ min: 1, max: 6 }), // consecutive terms
          (year, month, day, terms) => {
            let currentStart = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            for (let t = 0; t < terms; t++) {
              const currentEnd = computeInclusiveEndDate(currentStart, 'month', 1);
              const nextStart = addDays(currentEnd, 1);

              // Assert next term begins on the very next day
              assert.equal(calculateInclusiveDays(currentEnd, nextStart), 2);
              currentStart = nextStart;
            }
            return true;
          },
        ),
      );
    });
  });
});
