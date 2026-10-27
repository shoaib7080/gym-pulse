export const ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  FRONT_DESK: 'front_desk',
  MEMBER: 'member',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const STAFF_ROLES = [ROLES.OWNER, ROLES.MANAGER, ROLES.FRONT_DESK] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const BRANCH_SCOPES = {
  ALL: 'all',
  SELECTED: 'selected',
} as const;

export type BranchScope = (typeof BRANCH_SCOPES)[keyof typeof BRANCH_SCOPES];
