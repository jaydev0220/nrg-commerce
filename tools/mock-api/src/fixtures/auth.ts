import type { MockAuthSession, MockLog, MockPasskey, MockRole, MockStaff } from '../state.js';
import { archivedTime, fixtureTime, ids } from './ids.js';

const readPermissions: MockRole['permissions'] = [
	'business.read',
	'order.read',
	'product.read',
	'product.sku.read',
	'product.category.read',
	'product.image.read',
	'log.read',
	'staff.read'
];

const allPermissions: MockRole['permissions'] = [
	'business.read',
	'business.write',
	'order.read',
	'order.write',
	'product.read',
	'product.create',
	'product.update',
	'product.delete',
	'product.sku.read',
	'product.sku.create',
	'product.sku.update',
	'product.sku.delete',
	'product.category.read',
	'product.category.create',
	'product.category.update',
	'product.category.delete',
	'product.image.read',
	'product.image.create',
	'product.image.update',
	'product.image.delete',
	'log.read',
	'staff.read',
	'staff.create',
	'staff.update',
	'staff.delete'
];

export function createRoleFixtures(): MockRole[] {
	return [
		{ id: ids.roleAdmin, key: 'admin', name: 'Administrator', permissions: allPermissions },
		{
			id: ids.roleProduct,
			key: 'product-manager',
			name: 'Product Manager',
			permissions: allPermissions.filter((permission) => permission.startsWith('product.'))
		},
		{
			id: ids.roleOrder,
			key: 'order-manager',
			name: 'Order Manager',
			permissions: ['order.read', 'order.write', 'business.read', 'product.sku.read']
		},
		{
			id: ids.roleBusiness,
			key: 'business-manager',
			name: 'Business Manager',
			permissions: ['business.read', 'business.write']
		},
		{
			id: ids.roleReadOnly,
			key: 'read-only-admin',
			name: 'Read-only Admin',
			permissions: readPermissions
		}
	];
}

export function createStaffFixtures(roles: MockRole[]): MockStaff[] {
	const role = (id: string) => roles.find((entry) => entry.id === id)!;
	return [
		{
			id: ids.staffAdmin,
			email: 'admin@nrg.local',
			name: 'Mock Administrator',
			status: 'active',
			preferredMfaMethod: 'authenticator',
			lastLoginAt: fixtureTime,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime,
			roles: [role(ids.roleAdmin)]
		},
		{
			id: ids.staffProduct,
			email: 'product@nrg.local',
			name: 'Product Manager',
			status: 'active',
			preferredMfaMethod: 'passkey',
			lastLoginAt: new Date('2026-07-18T08:00:00.000Z'),
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime,
			roles: [role(ids.roleProduct)]
		},
		{
			id: ids.staffInactive,
			email: 'inactive@nrg.local',
			name: 'Inactive Staff',
			status: 'inactive',
			preferredMfaMethod: null,
			lastLoginAt: null,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime,
			roles: [role(ids.roleReadOnly)]
		},
		{
			id: ids.staffArchived,
			email: 'archived@nrg.local',
			name: 'Archived Staff',
			status: 'inactive',
			preferredMfaMethod: null,
			lastLoginAt: null,
			deletedAt: archivedTime,
			createdAt: fixtureTime,
			updatedAt: archivedTime,
			roles: [role(ids.roleReadOnly)]
		}
	];
}

export function createAuthSessionFixtures(): MockAuthSession[] {
	return [
		{
			id: ids.sessionCurrent,
			staffId: ids.staffAdmin,
			userAgent: 'NRG Mock Browser',
			ipAddress: '127.0.0.1',
			authenticatedAt: fixtureTime,
			lastSeenAt: fixtureTime,
			expiresAt: new Date('2027-07-19T00:00:00.000Z'),
			revokedAt: null
		},
		{
			id: ids.sessionOther,
			staffId: ids.staffAdmin,
			userAgent: 'Other Mock Browser',
			ipAddress: '127.0.0.1',
			authenticatedAt: new Date('2026-07-18T00:00:00.000Z'),
			lastSeenAt: new Date('2026-07-18T01:00:00.000Z'),
			expiresAt: new Date('2027-07-18T00:00:00.000Z'),
			revokedAt: null
		}
	];
}

export function createPasskeyFixtures(): MockPasskey[] {
	return [
		{
			id: ids.passkeyCurrent,
			nickname: 'Development Passkey',
			deviceType: 'multiDevice',
			backedUp: true,
			verifiedAt: fixtureTime,
			lastUsedAt: fixtureTime
		}
	];
}

export function createLogFixtures(): MockLog[] {
	const expiresAt = new Date('2027-07-19T00:00:00.000Z');
	return [
		{
			id: ids.logAudit,
			level: 'info',
			kind: 'audit',
			message: 'Product updated in mock data.',
			actorStaffId: ids.staffAdmin,
			requestId: 'mock-request-audit',
			method: 'PATCH',
			path: `/api/management/products/${ids.productBeaker}`,
			statusCode: 200,
			entityType: 'product',
			entityId: ids.productBeaker,
			metadata: { fixture: true },
			expiresAt,
			createdAt: fixtureTime
		},
		{
			id: ids.logRequest,
			level: 'info',
			kind: 'request',
			message: 'Storefront request completed.',
			actorStaffId: null,
			requestId: 'mock-request-storefront',
			method: 'GET',
			path: '/api/storefront/products',
			statusCode: 200,
			entityType: null,
			entityId: null,
			metadata: { durationMs: 2 },
			expiresAt,
			createdAt: new Date('2026-07-18T00:00:00.000Z')
		},
		{
			id: ids.logError,
			level: 'error',
			kind: 'request',
			message: 'Representative failed request.',
			actorStaffId: ids.staffAdmin,
			requestId: 'mock-request-error',
			method: 'POST',
			path: '/api/management/orders',
			statusCode: 409,
			entityType: 'order',
			entityId: null,
			metadata: { code: 'ORDER_INVOICE_NUMBER_CONFLICT' },
			expiresAt,
			createdAt: new Date('2026-07-17T00:00:00.000Z')
		}
	];
}
