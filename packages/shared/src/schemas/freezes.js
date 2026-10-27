"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewFreezeSchema = exports.earlyLiftFreezeSchema = exports.createFreezeSchema = exports.freezePreviewSchema = void 0;
const zod_1 = require("zod");
exports.freezePreviewSchema = zod_1.z.object({
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD required'),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD required'),
});
exports.createFreezeSchema = zod_1.z.object({
    membershipId: zod_1.z.string().uuid(),
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reasonCode: zod_1.z.enum(['medical', 'travel', 'relocation', 'religious_observance', 'other']),
    reasonNote: zod_1.z.string().max(500).optional(),
    proofStorageKey: zod_1.z.string().optional(),
});
exports.earlyLiftFreezeSchema = zod_1.z.object({
    liftedOnDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    managerPin: zod_1.z.string().optional(),
    reason: zod_1.z.string().default('early_return_authorized'),
});
exports.reviewFreezeSchema = zod_1.z.object({
    action: zod_1.z.enum(['approve', 'reject']),
    rejectionReason: zod_1.z.string().optional(),
});
//# sourceMappingURL=freezes.js.map