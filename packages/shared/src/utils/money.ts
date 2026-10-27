import { DEFAULT_VAT_RATE_BPS } from '../constants/finance.js';

/**
 * Custom half-up rounder for integer arithmetic
 * Uses exact math without floating-point drift.
 */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error('Division by zero');
  }
  const remainder = numerator % denominator;
  const quotient = numerator / denominator;
  // If 2 * remainder >= denominator, round up
  if (2n * remainder >= denominator) {
    return quotient + 1n;
  }
  return quotient;
}

export interface VatBreakdown {
  totalMinor: bigint;
  baseMinor: bigint;
  vatMinor: bigint;
  vatRateBps: number;
}

/**
 * Calculate VAT breakdown from a VAT-inclusive total price (in fils).
 * Formula from GymPulse Spec Section 8.4:
 * base = round_half_up(total * 10000 / (10000 + vat_rate_bps))
 * vat = total - base
 * Guarantees: total = base + vat
 */
export function calculateVatInclusive(
  totalMinor: bigint | number,
  vatRateBps: number = DEFAULT_VAT_RATE_BPS,
): VatBreakdown {
  const total = BigInt(totalMinor);
  const rateBps = BigInt(vatRateBps);

  if (vatRateBps === 0) {
    return {
      totalMinor: total,
      baseMinor: total,
      vatMinor: 0n,
      vatRateBps,
    };
  }

  const numerator = total * 10000n;
  const denominator = 10000n + rateBps;
  const base = roundHalfUp(numerator, denominator);
  const vat = total - base;

  return {
    totalMinor: total,
    baseMinor: base,
    vatMinor: vat,
    vatRateBps,
  };
}

/**
 * Calculate VAT breakdown from a VAT-exclusive base price (in fils).
 */
export function calculateVatExclusive(
  baseMinor: bigint | number,
  vatRateBps: number = DEFAULT_VAT_RATE_BPS,
): VatBreakdown {
  const base = BigInt(baseMinor);
  const rateBps = BigInt(vatRateBps);

  if (vatRateBps === 0) {
    return {
      totalMinor: base,
      baseMinor: base,
      vatMinor: 0n,
      vatRateBps,
    };
  }

  const numerator = base * rateBps;
  const denominator = 10000n;
  const vat = roundHalfUp(numerator, denominator);
  const total = base + vat;

  return {
    totalMinor: total,
    baseMinor: base,
    vatMinor: vat,
    vatRateBps,
  };
}

/**
 * Format minor units (fils) to standard currency string (e.g. 15000 -> "150.00 AED")
 */
export function formatCurrency(
  minorUnits: bigint | number,
  currency: string = 'AED',
  locale: string = 'en-AE',
): string {
  const major = Number(minorUnits) / 100;
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major)} ${currency}`;
}
