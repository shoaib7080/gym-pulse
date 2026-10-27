import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export declare const refreshSchema: z.ZodObject<{
    refreshToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    refreshToken?: string | undefined;
}, {
    refreshToken?: string | undefined;
}>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export declare const otpRequestSchema: z.ZodObject<{
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
}, {
    phone: string;
}>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export declare const otpVerifySchema: z.ZodObject<{
    phone: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    code: string;
}, {
    phone: string;
    code: string;
}>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export declare const mfaVerifySchema: z.ZodObject<{
    tempToken: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    tempToken: string;
}, {
    code: string;
    tempToken: string;
}>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export declare const mfaSetupConfirmSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export type MfaSetupConfirmInput = z.infer<typeof mfaSetupConfirmSchema>;
