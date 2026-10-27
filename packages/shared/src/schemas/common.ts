import { z } from 'zod';

export const idSchema = z.uuid();

// UAE Tax Registration Number: exactly 15 digits.
export const trnSchema = z
  .string()
  .regex(/^[0-9]{15}$/, 'TRN must be exactly 15 digits');
