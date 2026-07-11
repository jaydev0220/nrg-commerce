import type {
	LogKind,
	LogLevel,
	MfaMethod,
	OrderStatus,
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

export type ManagedBusinessRecord = {
	id: string;
	name: string;
	contactName: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	taxId: string | null;
	address: string | null;
	notes: string | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ManagedOrderItemRecord = {
	id: string;
	orderId: string;
	productSkuId: string | null;
	skuCode: string;
	productName: string;
	unitPrice: number;
	quantity: number;
	lineTotal: number;
	attributes: Prisma.JsonValue;
	createdAt: Date;
};

export type ManagedOrderRecord = {
	id: string;
	businessId: string | null;
	status: OrderStatus;
	customerName: string | null;
	customerEmail: string | null;
	customerPhone: string | null;
	customerAddress: string | null;
	itemCount: number;
	totalAmount: number;
	createdAt: Date;
	updatedAt: Date;
	business: ManagedBusinessRecord | null;
	items: ManagedOrderItemRecord[];
};
