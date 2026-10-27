import { z } from 'zod';

export const createPlanSchema = z.object({
  title: z.string().min(2).max(100),
  durationUnit: z.enum(['day', 'month']),
  durationValue: z.number().int().min(1),
  priceMinor: z.coerce.bigint().refine((val) => val >= 0n, {
    message: 'Price in fils must be greater than or equal to 0',
  }),
  currency: z.string().length(3).optional(),
  priceIncludesVat: z.boolean().default(true),
  graceDays: z.number().int().min(0).default(0),
  branchAccess: z.enum(['home_only', 'all_branches']).default('home_only'),
  accessSchedule: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = createPlanSchema.partial();
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const freezePolicySchema = z
  .object({
    planId: z.string().uuid().optional().nullable(), // null means gym default
    isEnabled: z.boolean().default(true),
    maxOccurrences: z.number().int().min(1).max(6).default(2),
    minDays: z.number().int().min(1).max(30).default(7),
    maxTotalDays: z.number().int().min(7).max(90).default(30),
    noticeDays: z.number().int().min(0).max(14).default(2),
    proofMode: z.enum(['none', 'optional', 'required']).default('none'),
    requireReview: z.boolean().default(false),
    cycleBasis: z.enum(['membership_term', 'anniversary_year']).default('membership_term'),
    allowRemainingBalance: z.boolean().default(true),
    feeMinor: z.coerce.bigint().default(0n),
    currency: z.string().length(3).optional(),
  })
  .refine((data) => data.minDays <= data.maxTotalDays, {
    message: 'minDays cannot exceed maxTotalDays',
    path: ['minDays'],
  });

export type FreezePolicyInput = z.infer<typeof freezePolicySchema>;
