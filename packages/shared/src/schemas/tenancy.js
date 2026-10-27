"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignStaffSchema = exports.createBranchSchema = exports.createGymSchema = void 0;
const zod_1 = require("zod");
const roles_js_1 = require("../constants/roles.js");
const finance_js_1 = require("../constants/finance.js");
exports.createGymSchema = zod_1.z
    .object({
    legalName: zod_1.z.string().min(2).max(255),
    tradeName: zod_1.z.string().min(2).max(255),
    tradeLicenseNumber: zod_1.z.string().min(2).max(100),
    vatRegistered: zod_1.z.boolean().default(false),
    trnNumber: zod_1.z
        .string()
        .regex(/^[0-9]{15}$/, 'UAE TRN must be exactly 15 digits')
        .optional()
        .nullable(),
    timezone: zod_1.z.string().default(finance_js_1.DEFAULT_TIMEZONE),
    currency: zod_1.z.enum([finance_js_1.CURRENCIES.AED, finance_js_1.CURRENCIES.SAR]).default(finance_js_1.DEFAULT_CURRENCY),
    settings: zod_1.z.record(zod_1.z.unknown()).default({}),
})
    .refine((data) => {
    if (data.vatRegistered && (!data.trnNumber || !/^[0-9]{15}$/.test(data.trnNumber))) {
        return false;
    }
    return true;
}, {
    message: 'TRN number is required and must be 15 digits when VAT registered',
    path: ['trnNumber'],
});
exports.createBranchSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    address: zod_1.z
        .object({
        street: zod_1.z.string().optional(),
        city: zod_1.z.string().default('Dubai'),
        emirate: zod_1.z.string().default('Dubai'),
        country: zod_1.z.string().default('United Arab Emirates'),
        postalCode: zod_1.z.string().optional(),
    })
        .default({}),
    isActive: zod_1.z.boolean().default(true),
});
exports.assignStaffSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    role: zod_1.z.enum(roles_js_1.STAFF_ROLES),
    branchScope: zod_1.z.enum([roles_js_1.BRANCH_SCOPES.ALL, roles_js_1.BRANCH_SCOPES.SELECTED]).default(roles_js_1.BRANCH_SCOPES.ALL),
    branchIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
});
//# sourceMappingURL=tenancy.js.map