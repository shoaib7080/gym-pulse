import { SetMetadata } from '@nestjs/common';

export const ALLOW_INACTIVE_GYM_KEY = 'allowInactiveGym';

/**
 * Decorator to allow requests on gyms that are pending verification, rejected, or suspended.
 * Permitted for administrative, onboarding, documentation, profile reading/editing, or status checks.
 */
export const AllowInactiveGym = () => SetMetadata(ALLOW_INACTIVE_GYM_KEY, true);
