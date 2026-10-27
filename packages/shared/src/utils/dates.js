"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDateOnly = parseDateOnly;
exports.formatDateOnly = formatDateOnly;
exports.calculateInclusiveDays = calculateInclusiveDays;
exports.addDays = addDays;
exports.calculateFreezeMath = calculateFreezeMath;
function parseDateOnly(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) {
        throw new Error(`Invalid date string: ${dateStr}. Expected YYYY-MM-DD`);
    }
    return new Date(Date.UTC(year, month - 1, day));
}
function formatDateOnly(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function calculateInclusiveDays(startDateStr, endDateStr) {
    const start = parseDateOnly(startDateStr);
    const end = parseDateOnly(endDateStr);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return diffDays + 1;
}
function addDays(dateStr, days) {
    const date = parseDateOnly(dateStr);
    date.setUTCDate(date.getUTCDate() + days);
    return formatDateOnly(date);
}
function calculateFreezeMath(params) {
    const { currentEndDate, startDate, endDate, minDays = 7, earlyReturnDate } = params;
    const N = calculateInclusiveDays(startDate, endDate);
    if (!earlyReturnDate) {
        return {
            requestedDays: N,
            daysCharged: N,
            daysReturned: 0,
            projectedEndDate: addDays(currentEndDate, N),
        };
    }
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
//# sourceMappingURL=dates.js.map