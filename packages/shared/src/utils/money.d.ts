export declare function roundHalfUp(numerator: bigint, denominator: bigint): bigint;
export interface VatBreakdown {
    totalMinor: bigint;
    baseMinor: bigint;
    vatMinor: bigint;
    vatRateBps: number;
}
export declare function calculateVatInclusive(totalMinor: bigint | number, vatRateBps?: number): VatBreakdown;
export declare function calculateVatExclusive(baseMinor: bigint | number, vatRateBps?: number): VatBreakdown;
export declare function formatCurrency(minorUnits: bigint | number, currency?: string, locale?: string): string;
