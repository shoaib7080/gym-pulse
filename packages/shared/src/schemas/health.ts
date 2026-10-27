import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const metaResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  apiPrefix: z.string(),
  timezone: z.string(),
  currency: z.string(),
});
export type MetaResponse = z.infer<typeof metaResponseSchema>;
