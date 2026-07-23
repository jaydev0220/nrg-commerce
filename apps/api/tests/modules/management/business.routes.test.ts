import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { errorHandler } from '../../../src/errors/error-handler.js';
import { createBusinessManagementRouter } from '../../../src/modules/management/business/business.routes.js';
import type { BusinessService } from '../../../src/modules/management/business/business.service.js';
import type { LogService } from '../../../src/modules/management/log/log.service.js';
import type { AuthenticatedStaffContext } from '../../../src/types/auth.js';
import { requestApp } from '../../helpers/http.js';

const authContext: AuthenticatedStaffContext = {
	staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
	sessionId: '0189076c-4f2a-7fe1-b9fd-2d68df455112',
	roles: ['admin'],
	permissions: ['business.read', 'business.write'],
	mfa: ['authenticator'],
	primaryFactor: 'password',
	staff: {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		email: 'admin@example.com',
		name: 'Admin',
		status: 'active',
		passwordHash: null,
		preferredMfaMethod: 'authenticator',
		lastLoginAt: null,
		failedAuthCount: 0,
		failedAuthWindowStartedAt: null,
		authBlockedUntil: null,
		roles: [],
		totpCredentialCount: 1,
		passkeyCredentialCount: 0
	}
};

function createBusinessRecord() {
	return {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455301',
		name: 'Northwind Trading',
		contactName: 'Iris Chen',
		contactEmail: 'iris@example.com',
		contactPhone: '02-1234-5678',
		taxId: '12345678',
		address: '台北市信義區市府路 1 號',
		notes: null,
		deletedAt: null,
		createdAt: new Date('2026-07-08T08:00:00.000Z'),
		updatedAt: new Date('2026-07-08T08:00:00.000Z')
	};
}

function createAppWithBusinesses(
	businessService: Pick<
		BusinessService,
		| 'listBusinesses'
		| 'createBusiness'
		| 'getBusiness'
		| 'updateBusiness'
		| 'deleteBusiness'
		| 'restoreBusiness'
		| 'bulkUpdateLabel'
	>,
	logService: Pick<LogService, 'recordAuditLog'>,
	permissions = authContext.permissions
) {
	const app = express();

	app.use(express.json());
	app.use((_request, response, next) => {
		response.locals['auth'] = {
			...authContext,
			permissions
		};
		next();
	});
	app.use(
		'/api/management/businesses',
		createBusinessManagementRouter({
			businessService: businessService as BusinessService,
			logService
		})
	);
	app.use(errorHandler);

	return app;
}

test('management business route lists paginated business records', async () => {
	let includeDeleted = false;
	const app = createAppWithBusinesses(
		{
			listBusinesses: async (query) => {
				includeDeleted = query.includeDeleted;
				return {
					data: [createBusinessRecord()],
					total: 1
				};
			},
			createBusiness: async () => createBusinessRecord(),
			getBusiness: async () => createBusinessRecord(),
			updateBusiness: async () => createBusinessRecord(),
			deleteBusiness: async () => 'soft',
			restoreBusiness: async () => createBusinessRecord(),
			bulkUpdateLabel: async () => 1
		},
		{
			recordAuditLog: async () => createBusinessAuditRecord()
		}
	);

	const response = await requestApp(app, {
		path: '/api/management/businesses?includeDeleted=true'
	});
	const payload = response.json<{
		data: Array<{ id: string; name: string }>;
		pagination: { page: number; limit: number; total: number; totalPages: number };
	}>();

	assert.equal(response.status, 200, response.text());
	assert.equal(includeDeleted, true);
	assert.equal(payload.data[0]?.name, 'Northwind Trading');
	assert.deepEqual(payload.pagination, {
		page: 1,
		limit: 20,
		total: 1,
		totalPages: 1
	});
});

test('management business route creates a business and records an audit log', async () => {
	let auditInput: Parameters<Pick<LogService, 'recordAuditLog'>['recordAuditLog']>[0] | undefined;
	const app = createAppWithBusinesses(
		{
			listBusinesses: async () => ({ data: [], total: 0 }),
			createBusiness: async () => createBusinessRecord(),
			getBusiness: async () => createBusinessRecord(),
			updateBusiness: async () => createBusinessRecord(),
			deleteBusiness: async () => 'soft',
			restoreBusiness: async () => createBusinessRecord(),
			bulkUpdateLabel: async () => 1
		},
		{
			recordAuditLog: async (input) => {
				auditInput = input;
				return createBusinessAuditRecord();
			}
		}
	);

	const response = await requestApp(app, {
		method: 'POST',
		path: '/api/management/businesses',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			name: 'Northwind Trading',
			contactName: 'Iris Chen'
		})
	});

	assert.equal(response.status, 201, response.text());
	assert.equal(auditInput?.entityType, 'business');
	assert.equal(auditInput?.entityId, createBusinessRecord().id);
});

test('management business route requires write permission for restore', async () => {
	const app = createAppWithBusinesses(
		{
			listBusinesses: async () => ({ data: [], total: 0 }),
			createBusiness: async () => createBusinessRecord(),
			getBusiness: async () => createBusinessRecord(),
			updateBusiness: async () => createBusinessRecord(),
			deleteBusiness: async () => 'soft',
			restoreBusiness: async () => createBusinessRecord(),
			bulkUpdateLabel: async () => 1
		},
		{
			recordAuditLog: async () => createBusinessAuditRecord()
		},
		['business.read']
	);

	const response = await requestApp(app, {
		method: 'POST',
		path: `/api/management/businesses/${createBusinessRecord().id}/restore`
	});
	const payload = response.json<{ error: { code: string } }>();

	assert.equal(response.status, 403);
	assert.equal(payload.error.code, 'FORBIDDEN');
});

test('management business route applies a bulk label update and records one audit log', async () => {
	let receivedInput: { businessIds: string[]; labelId: string | null } | undefined;
	let auditInput: Parameters<Pick<LogService, 'recordAuditLog'>['recordAuditLog']>[0] | undefined;
	const app = createAppWithBusinesses(
		{
			listBusinesses: async () => ({ data: [], total: 0 }),
			createBusiness: async () => createBusinessRecord(),
			getBusiness: async () => createBusinessRecord(),
			updateBusiness: async () => createBusinessRecord(),
			deleteBusiness: async () => 'soft',
			restoreBusiness: async () => createBusinessRecord(),
			bulkUpdateLabel: async (input) => {
				receivedInput = input;
				return 2;
			}
		},
		{
			recordAuditLog: async (input) => {
				auditInput = input;
				return createBusinessAuditRecord();
			}
		}
	);

	const response = await requestApp(app, {
		method: 'PATCH',
		path: '/api/management/businesses/bulk-label',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			businessIds: ['0189076c-4f2a-7fe1-b9fd-2d68df455301', '0189076c-4f2a-7fe1-b9fd-2d68df455302'],
			labelId: null
		})
	});

	assert.equal(response.status, 200, response.text());
	assert.deepEqual(receivedInput, {
		businessIds: ['0189076c-4f2a-7fe1-b9fd-2d68df455301', '0189076c-4f2a-7fe1-b9fd-2d68df455302'],
		labelId: null
	});
	assert.deepEqual(response.json(), { updatedCount: 2 });
	assert.deepEqual(auditInput?.metadata, { businessCount: 2, labelId: null });
});

function createBusinessAuditRecord() {
	return {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455399',
		level: 'info' as const,
		kind: 'audit' as const,
		message: 'ok',
		actorStaffId: authContext.staffId,
		requestId: 'request-1',
		method: 'POST',
		path: '/api/management/businesses',
		statusCode: 201,
		entityType: 'business',
		entityId: createBusinessRecord().id,
		metadata: null,
		expiresAt: new Date('2026-08-01T00:00:00.000Z'),
		createdAt: new Date('2026-07-08T08:00:00.000Z')
	};
}
