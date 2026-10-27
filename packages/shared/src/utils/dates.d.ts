export declare function parseDateOnly(dateStr: string): Date;
export declare function formatDateOnly(date: Date): string;
export declare function calculateInclusiveDays(startDateStr: string, endDateStr: string): number;
export declare function addDays(dateStr: string, days: number): string;
export interface FreezeMathResult {
    requestedDays: number;
    daysUsed?: number;
    daysCharged: number;
    daysReturned: number;
    projectedEndDate: string;
}
export declare function calculateFreezeMath(params: {
    currentEndDate: string;
    startDate: string;
    endDate: string;
    minDays?: number;
    earlyReturnDate?: string;
}): FreezeMathResult;
