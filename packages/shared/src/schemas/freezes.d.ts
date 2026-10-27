import { z } from 'zod';
export declare const freezePreviewSchema: z.ZodObject<{
    startDate: z.ZodString;
    endDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    startDate: string;
    endDate: string;
}, {
    startDate: string;
    endDate: string;
}>;
export type FreezePreviewInput = z.infer<typeof freezePreviewSchema>;
export declare const createFreezeSchema: z.ZodObject<{
    membershipId: z.ZodString;
    startDate: z.ZodString;
    endDate: z.ZodString;
    reasonCode: z.ZodEnum<["medical", "travel", "relocation", "religious_observance", "other"]>;
    reasonNote: z.ZodOptional<z.ZodString>;
    proofStorageKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    startDate: string;
    endDate: string;
    membershipId: string;
    reasonCode: "medical" | "travel" | "relocation" | "religious_observance" | "other";
    reasonNote?: string | undefined;
    proofStorageKey?: string | undefined;
}, {
    startDate: string;
    endDate: string;
    membershipId: string;
    reasonCode: "medical" | "travel" | "relocation" | "religious_observance" | "other";
    reasonNote?: string | undefined;
    proofStorageKey?: string | undefined;
}>;
export type CreateFreezeInput = z.infer<typeof createFreezeSchema>;
export declare const earlyLiftFreezeSchema: z.ZodObject<{
    liftedOnDate: z.ZodString;
    managerPin: z.ZodOptional<z.ZodString>;
    reason: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    liftedOnDate: string;
    managerPin?: string | undefined;
}, {
    liftedOnDate: string;
    reason?: string | undefined;
    managerPin?: string | undefined;
}>;
export type EarlyLiftFreezeInput = z.infer<typeof earlyLiftFreezeSchema>;
export declare const reviewFreezeSchema: z.ZodObject<{
    action: z.ZodEnum<["approve", "reject"]>;
    rejectionReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject";
    rejectionReason?: string | undefined;
}, {
    action: "approve" | "reject";
    rejectionReason?: string | undefined;
}>;
export type ReviewFreezeInput = z.infer<typeof reviewFreezeSchema>;
