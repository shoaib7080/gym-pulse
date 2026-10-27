import { z } from 'zod';
export declare const deskPaymentSchema: z.ZodObject<{
    memberId: z.ZodString;
    membershipId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    shiftId: z.ZodString;
    purpose: z.ZodEnum<["membership", "renewal", "freeze_fee", "other"]>;
    method: z.ZodEnum<["cash", "card_pos", "bank_transfer"]>;
    totalMinor: z.ZodEffects<z.ZodBigInt, bigint, bigint>;
    currency: z.ZodDefault<z.ZodEnum<["AED", "SAR"]>>;
    providerReference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    currency: "AED" | "SAR";
    memberId: string;
    shiftId: string;
    purpose: "renewal" | "other" | "membership" | "freeze_fee";
    method: "cash" | "card_pos" | "bank_transfer";
    totalMinor: bigint;
    membershipId?: string | null | undefined;
    providerReference?: string | undefined;
}, {
    memberId: string;
    shiftId: string;
    purpose: "renewal" | "other" | "membership" | "freeze_fee";
    method: "cash" | "card_pos" | "bank_transfer";
    totalMinor: bigint;
    currency?: "AED" | "SAR" | undefined;
    membershipId?: string | null | undefined;
    providerReference?: string | undefined;
}>;
export type DeskPaymentInput = z.infer<typeof deskPaymentSchema>;
export declare const voidPaymentSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;
