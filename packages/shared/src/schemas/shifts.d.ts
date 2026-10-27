import { z } from 'zod';
export declare const openShiftSchema: z.ZodObject<{
    branchId: z.ZodString;
    openingFloatMinor: z.ZodDefault<z.ZodBigInt>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    openingFloatMinor: bigint;
}, {
    branchId: string;
    openingFloatMinor?: bigint | undefined;
}>;
export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export declare const closeShiftSchema: z.ZodObject<{
    countedCashMinor: z.ZodEffects<z.ZodBigInt, bigint, bigint>;
    cardPosCountedMinor: z.ZodOptional<z.ZodBigInt>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    countedCashMinor: bigint;
    cardPosCountedMinor?: bigint | undefined;
    notes?: string | undefined;
}, {
    countedCashMinor: bigint;
    cardPosCountedMinor?: bigint | undefined;
    notes?: string | undefined;
}>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export declare const approveVarianceSchema: z.ZodObject<{
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
}, {
    notes?: string | undefined;
}>;
export type ApproveVarianceInput = z.infer<typeof approveVarianceSchema>;
