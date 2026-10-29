import { z } from 'zod';

export const saasPlanLimitsSchema = z.object({
  maxBranches: z.number().int().min(1).default(1),
  maxMembers: z.number().int().min(1).default(150),
  maxStaff: z.number().int().min(1).default(5),
});

export const createSaasPlanSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Plan code must be lowercase alphanumeric with dashes or underscores'),
  name: z.string().min(2).max(100),
  billingInterval: z.enum(['month', 'year']).default('month'),
  priceMinor: z.number().int().min(0),
  currency: z.string().length(3).default('AED'),
  limits: saasPlanLimitsSchema.default({
    maxBranches: 1,
    maxMembers: 150,
    maxStaff: 5,
  }),
  isActive: z.boolean().default(true),
});

export type CreateSaasPlanInput = z.infer<typeof createSaasPlanSchema>;

export const provisionSubscriptionSchema = z.object({
  gymId: z.string().min(1),
  saasPlanId: z.string().min(1),
  billingMethod: z
    .enum(['bank_transfer', 'payment_link', 'card_on_file'])
    .default('bank_transfer'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type ProvisionSubscriptionInput = z.infer<typeof provisionSubscriptionSchema>;

export const recordPlatformPaymentSchema = z.object({
  method: z.enum(['bank_transfer', 'card', 'payment_link']),
  amountMinor: z.number().int().positive(),
  reference: z.string().max(100).optional(),
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type RecordPlatformPaymentInput = z.infer<typeof recordPlatformPaymentSchema>;

export const changeSubscriptionSchema = z.object({
  saasPlanId: z.string().min(1),
  billingMethod: z
    .enum(['bank_transfer', 'payment_link', 'card_on_file'])
    .optional(),
});

export type ChangeSubscriptionInput = z.infer<typeof changeSubscriptionSchema>;

export const enqueueNotificationSchema = z.object({
  gymId: z.string().min(1),
  memberId: z.string().optional().nullable(),
  channel: z.enum(['push', 'whatsapp', 'sms', 'email']),
  template: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  dedupeKey: z.string().min(1),
});

export type EnqueueNotificationInput = z.infer<typeof enqueueNotificationSchema>;
