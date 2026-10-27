import { z } from 'zod';
import { BRANCH_SCOPES, STAFF_ROLES } from '../constants/roles.js';
import { CURRENCIES, DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '../constants/finance.js';

export const createGymSchema = z
  .object({
    legalName: z.string().min(2).max(255),
    tradeName: z.string().min(2).max(255),
    tradeLicenseNumber: z.string().min(2).max(100),
    vatRegistered: z.boolean().default(false),
    trnNumber: z
      .string()
      .regex(/^[0-9]{15}$/, 'UAE TRN must be exactly 15 digits')
      .optional()
      .nullable(),
    timezone: z.string().default(DEFAULT_TIMEZONE),
    currency: z.enum([CURRENCIES.AED, CURRENCIES.SAR, CURRENCIES.INR]).default(DEFAULT_CURRENCY),
    settings: z.record(z.string(), z.unknown()).default({}),
  })
  .refine(
    (data) => {
      if (data.vatRegistered && (!data.trnNumber || !/^[0-9]{15}$/.test(data.trnNumber))) {
        return false;
      }
      return true;
    },
    {
      message: 'TRN number is required and must be 15 digits when VAT registered',
      path: ['trnNumber'],
    },
  );

export type CreateGymInput = z.infer<typeof createGymSchema>;

export const createBranchSchema = z.object({
  name: z.string().min(2).max(100),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().default('Dubai'),
      emirate: z.string().default('Dubai'),
      country: z.string().default('United Arab Emirates'),
      postalCode: z.string().optional(),
    })
    .default({
      city: 'Dubai',
      emirate: 'Dubai',
      country: 'United Arab Emirates',
    }),
  isActive: z.boolean().default(true),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const assignStaffSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(STAFF_ROLES),
  branchScope: z.enum([BRANCH_SCOPES.ALL, BRANCH_SCOPES.SELECTED]).default(BRANCH_SCOPES.ALL),
  branchIds: z.array(z.string().uuid()).default([]),
});

export type AssignStaffInput = z.infer<typeof assignStaffSchema>;
