import type { MfaMethod, RoleKey, StaffStatus } from '@packages/database';

export type ManagedRoleRecord = {
	id: string;
	key: RoleKey;
	name: string;
	permissions: string[];
};

export type ManagedStaffRecord = {
	id: string;
	email: string;
	name: string;
	status: StaffStatus;
	mfaRequired: boolean;
	preferredMfaMethod: MfaMethod | null;
	lastLoginAt: Date | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	roles: ManagedRoleRecord[];
};
