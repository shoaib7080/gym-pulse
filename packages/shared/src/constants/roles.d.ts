export declare const ROLES: {
    readonly PLATFORM_ADMIN: "platform_admin";
    readonly OWNER: "owner";
    readonly MANAGER: "manager";
    readonly FRONT_DESK: "front_desk";
    readonly MEMBER: "member";
};
export type UserRole = (typeof ROLES)[keyof typeof ROLES];
export declare const STAFF_ROLES: readonly ["owner", "manager", "front_desk"];
export type StaffRole = (typeof STAFF_ROLES)[number];
export declare const BRANCH_SCOPES: {
    readonly ALL: "all";
    readonly SELECTED: "selected";
};
export type BranchScope = (typeof BRANCH_SCOPES)[keyof typeof BRANCH_SCOPES];
