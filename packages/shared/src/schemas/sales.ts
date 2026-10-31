import { z } from 'zod';

export const discountSchema = z.object({
  type: z.enum(['amount', 'percent']),
  value: z.number().positive('Discount value must be greater than 0'),
  reasonCode: z.string().min(1, 'Discount reason code is required'),
  note: z.string().optional(),
});

export type DiscountInput = z.infer<typeof discountSchema>;

export const createSaleMembershipSchema = z.object({
  memberId: z.string().uuid('Valid memberId UUID is required'),
  planId: z.string().uuid('Valid planId UUID is required'),
  branchId: z.string().uuid('Valid branchId UUID is required'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
    .optional(),
  method: z.enum(['cash', 'card_pos', 'bank_transfer']),
  discount: discountSchema.optional(),
}).strict();

export type CreateSaleMembershipInput = z.infer<typeof createSaleMembershipSchema>;

export const createRenewalSaleSchema = z.object({
  membershipId: z.string().uuid('Valid membershipId UUID is required'),
  planId: z.string().uuid('Valid planId UUID is required').optional(),
  branchId: z.string().uuid('Valid branchId UUID is required').optional(),
  method: z.enum(['cash', 'card_pos', 'bank_transfer']),
  discount: discountSchema.optional(),
}).strict();

export type CreateRenewalSaleInput = z.infer<typeof createRenewalSaleSchema>;
