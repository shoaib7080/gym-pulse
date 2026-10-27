"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mfaSetupConfirmSchema = exports.mfaVerifySchema = exports.otpVerifySchema = exports.otpRequestSchema = exports.refreshSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().optional(),
});
exports.otpRequestSchema = zod_1.z.object({
    phone: zod_1.z
        .string()
        .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in valid E.164 format (e.g. +971501234567)'),
});
exports.otpVerifySchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+[1-9]\d{6,14}$/),
    code: zod_1.z.string().length(6, 'Verification code must be 6 digits'),
});
exports.mfaVerifySchema = zod_1.z.object({
    tempToken: zod_1.z.string().min(1, 'Temporary token required'),
    code: zod_1.z.string().length(6, 'TOTP code must be 6 digits'),
});
exports.mfaSetupConfirmSchema = zod_1.z.object({
    code: zod_1.z.string().length(6, 'TOTP code must be 6 digits'),
});
//# sourceMappingURL=auth.js.map