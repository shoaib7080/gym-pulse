import { z } from 'zod';
export declare const createMemberSchema: z.ZodObject<{
    phone: z.ZodString;
    fullName: z.ZodString;
    email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    memberNumber: z.ZodOptional<z.ZodString>;
    homeBranchId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    gender: z.ZodNullable<z.ZodOptional<z.ZodEnum<["male", "female", "other"]>>>;
    dateOfBirth: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    emergencyContact: z.ZodDefault<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        relation: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        phone?: string | undefined;
        relation?: string | undefined;
    }, {
        name?: string | undefined;
        phone?: string | undefined;
        relation?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    fullName: string;
    emergencyContact: {
        name?: string | undefined;
        phone?: string | undefined;
        relation?: string | undefined;
    };
    email?: string | null | undefined;
    memberNumber?: string | undefined;
    homeBranchId?: string | null | undefined;
    gender?: "other" | "male" | "female" | null | undefined;
    dateOfBirth?: string | null | undefined;
}, {
    phone: string;
    fullName: string;
    email?: string | null | undefined;
    memberNumber?: string | undefined;
    homeBranchId?: string | null | undefined;
    gender?: "other" | "male" | "female" | null | undefined;
    dateOfBirth?: string | null | undefined;
    emergencyContact?: {
        name?: string | undefined;
        phone?: string | undefined;
        relation?: string | undefined;
    } | undefined;
}>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export declare const updateMemberSchema: z.ZodObject<{
    phone: z.ZodOptional<z.ZodString>;
    fullName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    memberNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    homeBranchId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    gender: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodEnum<["male", "female", "other"]>>>>;
    dateOfBirth: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    emergencyContact: z.ZodOptional<z.ZodDefault<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        relation: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        phone?: string | undefined;
        relation?: string | undefined;
    }, {
        name?: string | undefined;
        phone?: string | undefined;
        relation?: string | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    phone?: string | undefined;
    email?: string | null | undefined;
    fullName?: string | undefined;
    memberNumber?: string | undefined;
    homeBranchId?: string | null | undefined;
    gender?: "other" | "male" | "female" | null | undefined;
    dateOfBirth?: string | null | undefined;
    emergencyContact?: {
        name?: string | undefined;
        phone?: string | undefined;
        relation?: string | undefined;
    } | undefined;
}, {
    phone?: string | undefined;
    email?: string | null | undefined;
    fullName?: string | undefined;
    memberNumber?: string | undefined;
    homeBranchId?: string | null | undefined;
    gender?: "other" | "male" | "female" | null | undefined;
    dateOfBirth?: string | null | undefined;
    emergencyContact?: {
        name?: string | undefined;
        phone?: string | undefined;
        relation?: string | undefined;
    } | undefined;
}>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export declare const memberSearchSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit: number;
}, {
    query: string;
    limit?: number | undefined;
}>;
export type MemberSearchInput = z.infer<typeof memberSearchSchema>;
