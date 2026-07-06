import type {
	LogKind,
	LogLevel,
	MfaMethod,
	Prisma,
	RoleKey,
	StaffStatus
} from '@packages/database';

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

export type ManagedLogRecord = {
	id: string;
	level: LogLevel;
	kind: LogKind;
	message: string;
	actorStaffId: string | null;
	requestId: string | null;
	method: string | null;
	path: string | null;
	statusCode: number | null;
	entityType: string | null;
	entityId: string | null;
	metadata: Prisma.JsonValue | null;
	expiresAt: Date;
	createdAt: Date;
};
