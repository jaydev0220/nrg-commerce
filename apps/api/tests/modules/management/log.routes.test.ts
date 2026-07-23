import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { errorHandler } from '../../../src/errors/error-handler.js';
import { createLogManagementRouter } from '../../../src/modules/management/log/log.routes.js';
import type { LogService } from '../../../src/modules/management/log/log.service.js';
import type { AuthenticatedStaffContext } from '../../../src/types/auth.js';
import { requestApp } from '../../helpers/http.js';

const authContext: AuthenticatedStaffContext = {
	staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
	sessionId: '0189076c-4f2a-7fe1-b9fd-2d68df455112',
	roles: ['admin'],
	permissions: ['log.read'],
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

function createAppWithLogs(
	logService: Pick<LogService, 'listLogs' | 'getLog'>,
	permissions = authContext.permissions
) {
	const app = express();

	app.use((_request, response, next) => {
		response.locals['auth'] = {
			...authContext,
			permissions
		};
		next();
	});
	app.use('/api/management/logs', createLogManagementRouter({ logService }));
	app.use(errorHandler);

	return app;
}

test('management log route returns paginated log records', async () => {
	let queryKind: string | undefined;
	const app = createAppWithLogs({
		getLog: async () => {
			throw new Error('not used');
		},
		listLogs: async (query) => {
			queryKind = query.kind;
			return {
				data: [
					{
						id: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
						level: 'error',
						kind: 'request',
						message: 'Request failed',
						actorStaffId: null,
						requestId: 'request-1',
						method: 'GET',
						path: '/api/management/products',
						statusCode: 500,
						entityType: null,
						entityId: null,
						metadata: { durationMs: 120 },
						expiresAt: new Date('2027-01-02T00:00:00.000Z'),
						createdAt: new Date('2026-07-06T00:00:00.000Z')
					}
				],
				total: 1
			};
		}
	});

	const response = await requestApp(app, {
		path: '/api/management/logs?kind=request&level=error'
	});
	const payload = response.json<{
		data: Array<{ id: string; kind: string; level: string; requestId: string }>;
		pagination: { page: number; limit: number; total: number; totalPages: number };
	}>();

	assert.equal(response.status, 200, response.text());
	assert.equal(queryKind, 'request');
	assert.equal(payload.data[0]?.level, 'error');
	assert.deepEqual(payload.pagination, {
		page: 1,
		limit: 20,
		total: 1,
		totalPages: 1
	});
});

test('management log route requires log read permission', async () => {
	const app = createAppWithLogs(
		{
			getLog: async () => {
				throw new Error('not used');
			},
			listLogs: async () => ({ data: [], total: 0 })
		},
		['staff.read']
	);

	const response = await requestApp(app, {
		path: '/api/management/logs'
	});
	const payload = response.json<{ error: { code: string } }>();

	assert.equal(response.status, 403);
	assert.equal(payload.error.code, 'FORBIDDEN');
});
