import { z } from 'zod';

export const openShiftSchema = z.object({
  branchId: z.string().uuid(),
  openingFloatMinor: z.coerce.bigint().default(0n),
  currency: z.string().length(3).optional(),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;

export const closeShiftSchema = z.object({
  countedCashMinor: z.coerce.bigint().refine((val) => val >= 0n, {
    message: 'Counted cash cannot be negative',
  }),
  cardPosCountedMinor: z.coerce.bigint().optional(),
  notes: z.string().max(1000).optional(),
});

export type CloseShiftInput = z.infer<typeof closeShiftSchema>;

export const approveVarianceSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export type ApproveVarianceInput = z.infer<typeof approveVarianceSchema>;
