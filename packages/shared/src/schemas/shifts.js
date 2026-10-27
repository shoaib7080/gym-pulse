"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveVarianceSchema = exports.closeShiftSchema = exports.openShiftSchema = void 0;
const zod_1 = require("zod");
exports.openShiftSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid(),
    openingFloatMinor: zod_1.z.coerce.bigint().default(0n),
});
exports.closeShiftSchema = zod_1.z.object({
    countedCashMinor: zod_1.z.coerce.bigint().refine((val) => val >= 0n, {
        message: 'Counted cash cannot be negative',
    }),
    cardPosCountedMinor: zod_1.z.coerce.bigint().optional(),
    notes: zod_1.z.string().max(1000).optional(),
});
exports.approveVarianceSchema = zod_1.z.object({
    notes: zod_1.z.string().max(1000).optional(),
});
//# sourceMappingURL=shifts.js.map