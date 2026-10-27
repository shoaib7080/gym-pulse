import { z } from 'zod';
import { GYM_STATUSES } from '../constants.js';

export const gymStatusSchema = z.enum(GYM_STATUSES);
export type GymStatus = z.infer<typeof gymStatusSchema>;
