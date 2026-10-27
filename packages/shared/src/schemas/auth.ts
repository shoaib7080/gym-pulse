import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

export const otpRequestSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in valid E.164 format (e.g. +971501234567)'),
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const mfaVerifySchema = z.object({
  tempToken: z.string().min(1, 'Temporary token required'),
  code: z.string().length(6, 'TOTP code must be 6 digits'),
});

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const mfaSetupConfirmSchema = z.object({
  code: z.string().length(6, 'TOTP code must be 6 digits'),
});

export type MfaSetupConfirmInput = z.infer<typeof mfaSetupConfirmSchema>;
