"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voidPaymentSchema = exports.deskPaymentSchema = void 0;
const zod_1 = require("zod");
const finance_js_1 = require("../constants/finance.js");
exports.deskPaymentSchema = zod_1.z.object({
    memberId: zod_1.z.string().uuid(),
    membershipId: zod_1.z.string().uuid().optional().nullable(),
    shiftId: zod_1.z.string().uuid(),
    purpose: zod_1.z.enum([
        finance_js_1.PAYMENT_PURPOSES.MEMBERSHIP,
        finance_js_1.PAYMENT_PURPOSES.RENEWAL,
        finance_js_1.PAYMENT_PURPOSES.FREEZE_FEE,
        finance_js_1.PAYMENT_PURPOSES.OTHER,
    ]),
    method: zod_1.z.enum(['cash', 'card_pos', 'bank_transfer']),
    totalMinor: zod_1.z.coerce.bigint().refine((val) => val >= 0n, {
        message: 'Total amount in fils must be positive',
    }),
    currency: zod_1.z.enum([finance_js_1.CURRENCIES.AED, finance_js_1.CURRENCIES.SAR]).default(finance_js_1.DEFAULT_CURRENCY),
    providerReference: zod_1.z.string().optional(),
});
exports.voidPaymentSchema = zod_1.z.object({
    reason: zod_1.z.string().min(5, 'Reason must be at least 5 characters').max(500),
});
//# sourceMappingURL=payments.js.map