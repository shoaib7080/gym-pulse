import { z } from 'zod';

export const freezePreviewSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD required'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD required'),
});

export type FreezePreviewInput = z.infer<typeof freezePreviewSchema>;

export const createFreezeSchema = z.object({
  membershipId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reasonCode: z.enum(['medical', 'travel', 'relocation', 'religious_observance', 'other']),
  reasonNote: z.string().max(500).optional(),
  proofStorageKey: z.string().optional(),
});

export type CreateFreezeInput = z.infer<typeof createFreezeSchema>;

export const earlyLiftFreezeSchema = z.object({
  liftedOnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD required'),
  approverUserId: z.string().uuid().optional(),
  managerPin: z.string().optional(),
  reason: z.string().default('early_return_authorized'),
});

export type EarlyLiftFreezeInput = z.infer<typeof earlyLiftFreezeSchema>;

export const reviewFreezeSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().optional(),
});

export type ReviewFreezeInput = z.infer<typeof reviewFreezeSchema>;

export const createProofTargetSchema = z.object({
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024, 'File size must not exceed 5 MB'),
});

export type CreateProofTargetInput = z.infer<typeof createProofTargetSchema>;

export const attachProofSchema = z.object({
  storageKey: z.string().min(10).max(500),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});

export type AttachProofInput = z.infer<typeof attachProofSchema>;
