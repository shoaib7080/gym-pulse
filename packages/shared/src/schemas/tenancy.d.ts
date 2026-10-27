import { z } from 'zod';
export declare const createGymSchema: z.ZodEffects<z.ZodObject<{
    legalName: z.ZodString;
    tradeName: z.ZodString;
    tradeLicenseNumber: z.ZodString;
    vatRegistered: z.ZodDefault<z.ZodBoolean>;
    trnNumber: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    timezone: z.ZodDefault<z.ZodString>;
    currency: z.ZodDefault<z.ZodEnum<["AED", "SAR"]>>;
    settings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    tradeName: string;
    tradeLicenseNumber: string;
    vatRegistered: boolean;
    timezone: string;
    currency: "AED" | "SAR";
    settings: Record<string, unknown>;
    trnNumber?: string | null | undefined;
}, {
    legalName: string;
    tradeName: string;
    tradeLicenseNumber: string;
    vatRegistered?: boolean | undefined;
    trnNumber?: string | null | undefined;
    timezone?: string | undefined;
    currency?: "AED" | "SAR" | undefined;
    settings?: Record<string, unknown> | undefined;
}>, {
    legalName: string;
    tradeName: string;
    tradeLicenseNumber: string;
    vatRegistered: boolean;
    timezone: string;
    currency: "AED" | "SAR";
    settings: Record<string, unknown>;
    trnNumber?: string | null | undefined;
}, {
    legalName: string;
    tradeName: string;
    tradeLicenseNumber: string;
    vatRegistered?: boolean | undefined;
    trnNumber?: string | null | undefined;
    timezone?: string | undefined;
    currency?: "AED" | "SAR" | undefined;
    settings?: Record<string, unknown> | undefined;
}>;
export type CreateGymInput = z.infer<typeof createGymSchema>;
export declare const createBranchSchema: z.ZodObject<{
    name: z.ZodString;
    address: z.ZodDefault<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodDefault<z.ZodString>;
        emirate: z.ZodDefault<z.ZodString>;
        country: z.ZodDefault<z.ZodString>;
        postalCode: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        city: string;
        emirate: string;
        country: string;
        street?: string | undefined;
        postalCode?: string | undefined;
    }, {
        street?: string | undefined;
        city?: string | undefined;
        emirate?: string | undefined;
        country?: string | undefined;
        postalCode?: string | undefined;
    }>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    address: {
        city: string;
        emirate: string;
        country: string;
        street?: string | undefined;
        postalCode?: string | undefined;
    };
    isActive: boolean;
}, {
    name: string;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        emirate?: string | undefined;
        country?: string | undefined;
        postalCode?: string | undefined;
    } | undefined;
    isActive?: boolean | undefined;
}>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export declare const assignStaffSchema: z.ZodObject<{
    userId: z.ZodString;
    role: z.ZodEnum<["owner", "manager", "front_desk"]>;
    branchScope: z.ZodDefault<z.ZodEnum<["all", "selected"]>>;
    branchIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    role: "owner" | "manager" | "front_desk";
    branchScope: "all" | "selected";
    branchIds: string[];
}, {
    userId: string;
    role: "owner" | "manager" | "front_desk";
    branchScope?: "all" | "selected" | undefined;
    branchIds?: string[] | undefined;
}>;
export type AssignStaffInput = z.infer<typeof assignStaffSchema>;
