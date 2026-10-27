"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberSearchSchema = exports.updateMemberSchema = exports.createMemberSchema = void 0;
const zod_1 = require("zod");
exports.createMemberSchema = zod_1.z.object({
    phone: zod_1.z
        .string()
        .regex(/^\+[1-9]\d{6,14}$/, 'Valid E.164 phone number required (e.g. +971501234567)'),
    fullName: zod_1.z.string().min(2).max(255),
    email: zod_1.z.string().email().optional().nullable(),
    memberNumber: zod_1.z.string().min(1).max(50).optional(),
    homeBranchId: zod_1.z.string().uuid().optional().nullable(),
    gender: zod_1.z.enum(['male', 'female', 'other']).optional().nullable(),
    dateOfBirth: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD required').optional().nullable(),
    emergencyContact: zod_1.z
        .object({
        name: zod_1.z.string().optional(),
        relation: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
    })
        .default({}),
});
exports.updateMemberSchema = exports.createMemberSchema.partial();
exports.memberSearchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(100),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
});
//# sourceMappingURL=members.js.map