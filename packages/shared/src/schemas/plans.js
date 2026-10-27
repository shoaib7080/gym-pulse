"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freezePolicySchema = exports.updatePlanSchema = exports.createPlanSchema = void 0;
const zod_1 = require("zod");
exports.createPlanSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(100),
    durationUnit: zod_1.z.enum(['day', 'month']),
    durationValue: zod_1.z.number().int().min(1),
    priceMinor: zod_1.z.coerce.bigint().refine((val) => val >= 0n, {
        message: 'Price in fils must be greater than or equal to 0',
    }),
    priceIncludesVat: zod_1.z.boolean().default(true),
    graceDays: zod_1.z.number().int().min(0).default(0),
    branchAccess: zod_1.z.enum(['home_only', 'all_branches']).default('home_only'),
    accessSchedule: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
    isActive: zod_1.z.boolean().default(true),
});
exports.updatePlanSchema = exports.createPlanSchema.partial();
exports.freezePolicySchema = zod_1.z
    .object({
    planId: zod_1.z.string().uuid().optional().nullable(),
    isEnabled: zod_1.z.boolean().default(true),
    maxOccurrences: zod_1.z.number().int().min(1).max(6).default(2),
    minDays: zod_1.z.number().int().min(1).max(30).default(7),
    maxTotalDays: zod_1.z.number().int().min(7).max(90).default(30),
    noticeDays: zod_1.z.number().int().min(0).max(14).default(2),
    proofMode: zod_1.z.enum(['none', 'optional', 'required']).default('none'),
    requireReview: zod_1.z.boolean().default(false),
    cycleBasis: zod_1.z.enum(['membership_term', 'anniversary_year']).default('membership_term'),
    allowRemainingBalance: zod_1.z.boolean().default(true),
    feeMinor: zod_1.z.coerce.bigint().default(0n),
})
    .refine((data) => data.minDays <= data.maxTotalDays, {
    message: 'minDays cannot exceed maxTotalDays',
    path: ['minDays'],
});
//# sourceMappingURL=plans.js.map