import { z } from 'zod';

export const createMemberSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'Valid E.164 phone number required (e.g. +971501234567)'),
  fullName: z.string().min(2).max(255),
  email: z.string().email().optional().nullable(),
  memberNumber: z.string().min(1).max(50).optional(), // Can be auto-generated if omitted
  homeBranchId: z.string().uuid().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD required').optional().nullable(),
  emergencyContact: z
    .object({
      name: z.string().optional(),
      relation: z.string().optional(),
      phone: z.string().optional(),
    })
    .default({}),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = createMemberSchema.partial();
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const memberSearchSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type MemberSearchInput = z.infer<typeof memberSearchSchema>;
