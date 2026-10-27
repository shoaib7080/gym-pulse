export const API_PREFIX = 'v1';

export const GYM_STATUSES = [
  'pending_verification',
  'active',
  'suspended',
  'closed',
] as const;

export const MEMBERSHIP_STATUSES = [
  'pending_payment',
  'active',
  'frozen',
  'expired',
  'cancelled',
] as const;

export * from './constants/errors.js';
export * from './constants/finance.js';
export * from './constants/roles.js';
