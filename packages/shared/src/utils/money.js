"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundHalfUp = roundHalfUp;
exports.calculateVatInclusive = calculateVatInclusive;
exports.calculateVatExclusive = calculateVatExclusive;
exports.formatCurrency = formatCurrency;
const finance_js_1 = require("../constants/finance.js");
function roundHalfUp(numerator, denominator) {
    if (denominator === 0n) {
        throw new Error('Division by zero');
    }
    const remainder = numerator % denominator;
    const quotient = numerator / denominator;
    if (2n * remainder >= denominator) {
        return quotient + 1n;
    }
    return quotient;
}
function calculateVatInclusive(totalMinor, vatRateBps = finance_js_1.DEFAULT_VAT_RATE_BPS) {
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
function calculateVatExclusive(baseMinor, vatRateBps = finance_js_1.DEFAULT_VAT_RATE_BPS) {
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
function formatCurrency(minorUnits, currency = 'AED', locale = 'en-AE') {
    const major = Number(minorUnits) / 100;
    return `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(major)} ${currency}`;
}
//# sourceMappingURL=money.js.map