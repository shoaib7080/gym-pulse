import { z } from 'zod';
import { CURRENCIES, DEFAULT_CURRENCY, PAYMENT_PURPOSES } from '../constants/finance.js';

export const deskPaymentSchema = z.object({
  memberId: z.string().uuid(),
  membershipId: z.string().uuid().optional().nullable(),
  shiftId: z.string().uuid(),
  purpose: z.enum([
    PAYMENT_PURPOSES.MEMBERSHIP,
    PAYMENT_PURPOSES.RENEWAL,
    PAYMENT_PURPOSES.FREEZE_FEE,
    PAYMENT_PURPOSES.OTHER,
  ]),
  method: z.enum(['cash', 'card_pos', 'bank_transfer']),
  totalMinor: z.coerce.bigint().refine((val) => val >= 0n, {
    message: 'Total amount in fils must be positive',
  }),
  currency: z.enum([CURRENCIES.AED, CURRENCIES.SAR]).default(DEFAULT_CURRENCY),
  providerReference: z.string().optional(),
});

export type DeskPaymentInput = z.infer<typeof deskPaymentSchema>;

export const voidPaymentSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
});

export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

export const gymPaymentAccountStatusSchema = z.enum([
  'not_started',
  'onboarding',
  'restricted',
  'active',
  'disabled',
]);

export type GymPaymentAccountStatus = z.infer<typeof gymPaymentAccountStatusSchema>;

/**
 * Direct representation of a gym_payment_accounts row.
 * Stores only provider account IDs (e.g. Tap merchant ID, Razorpay Route linked-account ID, Stripe connect account ID).
 * Platform master API keys are maintained in a secure secrets manager / environment variables.
 */
export const gymPaymentAccountSchema = z.object({
  provider: z.enum(['tap', 'razorpay', 'stripe']),
  providerAccountId: z.string().min(1, 'Provider account ID is required'),
  status: gymPaymentAccountStatusSchema.default('active'),
  currency: z.enum([CURRENCIES.AED, CURRENCIES.SAR, CURRENCIES.INR]).default(DEFAULT_CURRENCY),
  onboardingCompleted: z.boolean().default(false),
  chargesEnabled: z.boolean().default(false),
  payoutsEnabled: z.boolean().default(false),
  detailsSubmitted: z.boolean().default(false),
  // Optional interim secret: encrypted with AES-256-GCM at rest, never returned in API responses
  interimSecret: z.string().optional(),
});

export type GymPaymentAccountInput = z.infer<typeof gymPaymentAccountSchema>;

export const tapProviderSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  merchantId: z.string().optional(),
  providerAccountId: z.string().optional(),
  publicKey: z.string().optional(),
  secretKey: z.string().optional(), // Interim only: encrypted with AES-256-GCM, never returned
  currency: z.string().default('AED'),
  webhookSecret: z.string().optional(),
});

export const razorpayProviderSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  accountId: z.string().optional(), // Razorpay Route linked account ID
  providerAccountId: z.string().optional(),
  keyId: z.string().optional(),
  keySecret: z.string().optional(), // Interim only: encrypted with AES-256-GCM, never returned
  currency: z.string().default('INR'),
  webhookSecret: z.string().optional(),
});

export const stripeProviderSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  accountId: z.string().optional(),
  providerAccountId: z.string().optional(),
  publishableKey: z.string().optional(),
  currency: z.string().default('AED'),
});

export const paymentProviderConfigSchema = z.object({
  defaultProvider: z.enum(['tap', 'razorpay', 'stripe']).default('tap'),
  providers: z
    .object({
      tap: tapProviderSettingsSchema.optional(),
      razorpay: razorpayProviderSettingsSchema.optional(),
      stripe: stripeProviderSettingsSchema.optional(),
    })
    .default({}),
});

export type PaymentProviderConfig = z.infer<typeof paymentProviderConfigSchema>;

export const updatePaymentConfigSchema = z.object({
  defaultProvider: z.enum(['tap', 'razorpay', 'stripe']).optional(),
  accounts: z.array(gymPaymentAccountSchema).optional(),
  providers: z
    .object({
      tap: tapProviderSettingsSchema.partial().optional(),
      razorpay: razorpayProviderSettingsSchema.partial().optional(),
      stripe: stripeProviderSettingsSchema.partial().optional(),
    })
    .optional(),
});

export type UpdatePaymentConfigInput = z.infer<typeof updatePaymentConfigSchema>;
