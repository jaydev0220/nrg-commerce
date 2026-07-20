import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@packages/database';

import {
	createLogService,
	resolveLogExpiresAt
} from '../../../src/modules/management/log/log.service.js';

const fixedNow = new Date('2026-07-06T00:00:00.000Z');

test('resolveLogExpiresAt applies the retention matrix by severity', () => {
	assert.equal(resolveLogExpiresAt('debug', fixedNow).toISOString(), '2026-07-13T00:00:00.000Z');
	assert.equal(resolveLogExpiresAt('info', fixedNow).toISOString(), '2026-08-05T00:00:00.000Z');
	assert.equal(resolveLogExpiresAt('warn', fixedNow).toISOString(), '2026-10-04T00:00:00.000Z');
	assert.equal(resolveLogExpiresAt('error', fixedNow).toISOString(), '2027-01-02T00:00:00.000Z');
	assert.equal(resolveLogExpiresAt('fatal', fixedNow).toISOString(), '2027-07-06T00:00:00.000Z');
});

test('listLogs injects the current time so expired rows are excluded by the repository', async () => {
	let listInputNow: Date | undefined;
	const logService = createLogService({
		repository: {
			listLogs: async (input) => {
				listInputNow = input.now;
				return { data: [], total: 0 };
			},
			createLog: async () => {
				throw new Error('not used');
			},
			findLogById: async () => null,
			deleteExpiredLogs: async () => 0
		},
		now: () => fixedNow
	});

	await logService.listLogs({
		page: 1,
		limit: 20,
		sort: 'createdAt',
		order: 'desc'
	});

	assert.equal(listInputNow, fixedNow);
});

test('recordAuditLog creates an expiring audit record with default info severity', async () => {
	let createInput:
		Parameters<Parameters<typeof createLogService>[0]['repository']['createLog']>[0] | undefined;
	const logService = createLogService({
		repository: {
			listLogs: async () => ({ data: [], total: 0 }),
			createLog: async (input) => {
				createInput = input;
				return {
					id: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
					level: input.level,
					kind: input.kind,
					message: input.message,
					actorStaffId: input.actorStaffId,
					requestId: input.requestId,
					method: input.method,
					path: input.path,
					statusCode: input.statusCode,
					entityType: input.entityType,
					entityId: input.entityId,
					metadata: null,
					expiresAt: input.expiresAt,
					createdAt: fixedNow
				};
			},
			findLogById: async () => null,
			deleteExpiredLogs: async () => 0
		},
		now: () => fixedNow
	});

	await logService.recordAuditLog({
		message: 'Staff created a product.',
		actorStaffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		requestId: 'request-1',
		method: 'POST',
		path: '/api/management/products',
		statusCode: 201,
		entityType: 'product',
		entityId: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
		metadata: { published: true }
	});

	assert.deepEqual(createInput, {
		level: 'info',
		kind: 'audit',
		message: 'Staff created a product.',
		actorStaffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		requestId: 'request-1',
		method: 'POST',
		path: '/api/management/products',
		statusCode: 201,
		entityType: 'product',
		entityId: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
		metadata: { published: true },
		expiresAt: new Date('2026-08-05T00:00:00.000Z')
	});
});

test('recordRequestLog creates a sanitized expiring request record', async () => {
	let createInput:
		Parameters<Parameters<typeof createLogService>[0]['repository']['createLog']>[0] | undefined;
	const logService = createLogService({
		repository: {
			listLogs: async () => ({ data: [], total: 0 }),
			createLog: async (input) => {
				createInput = input;
				return {
					id: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
					level: input.level,
					kind: input.kind,
					message: input.message,
					actorStaffId: input.actorStaffId,
					requestId: input.requestId,
					method: input.method,
					path: input.path,
					statusCode: input.statusCode,
					entityType: input.entityType,
					entityId: input.entityId,
					metadata: input.metadata as Prisma.JsonValue | null,
					expiresAt: input.expiresAt,
					createdAt: fixedNow
				};
			},
			findLogById: async () => null,
			deleteExpiredLogs: async () => 0
		},
		now: () => fixedNow
	});

	await logService.recordRequestLog({
		level: 'error',
		message: 'API token=private-token failed.',
		actorStaffId: null,
		requestId: 'request-1',
		method: 'GET',
		path: '/api/management/orders',
		statusCode: 500,
		metadata: { error: { message: 'token=private-token' } }
	});

	assert.deepEqual(createInput, {
		level: 'error',
		kind: 'request',
		message: 'API token=[REDACTED] failed.',
		actorStaffId: null,
		requestId: 'request-1',
		method: 'GET',
		path: '/api/management/orders',
		statusCode: 500,
		entityType: null,
		entityId: null,
		metadata: { error: { message: 'token=[REDACTED]' } },
		expiresAt: new Date('2027-01-02T00:00:00.000Z')
	});
});

test('pruneExpiredLogs deletes rows using the current time', async () => {
	let pruneInputNow: Date | undefined;
	const logService = createLogService({
		repository: {
			listLogs: async () => ({ data: [], total: 0 }),
			createLog: async () => {
				throw new Error('not used');
			},
			findLogById: async () => null,
			deleteExpiredLogs: async (now) => {
				pruneInputNow = now;
				return 3;
			}
		},
		now: () => fixedNow
	});

	assert.equal(await logService.pruneExpiredLogs(), 3);
	assert.equal(pruneInputNow, fixedNow);
});

test('getLog redacts nested sensitive metadata', async () => {
	const logService = createLogService({
		repository: {
			listLogs: async () => ({ data: [], total: 0 }),
			createLog: async () => {
				throw new Error('not used');
			},
			findLogById: async () => ({
				id: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
				level: 'info',
				kind: 'audit',
				message: 'Login',
				actorStaffId: null,
				requestId: null,
				method: null,
				path: null,
				statusCode: null,
				entityType: null,
				entityId: null,
				metadata: {
					email: 'staff@example.com',
					authorization: 'Bearer secret',
					nested: { password: 'secret' }
				},
				expiresAt: new Date('2026-08-05T00:00:00.000Z'),
				createdAt: fixedNow
			}),
			deleteExpiredLogs: async () => 0
		},
		now: () => fixedNow
	});

	const log = await logService.getLog('9be808ab-bd34-4cf4-b8ae-db0f819ff5e6');
	assert.deepEqual(log.metadata, {
		email: 'staff@example.com',
		authorization: '[REDACTED]',
		nested: { password: '[REDACTED]' }
	});
});
