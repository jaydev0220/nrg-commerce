import assert from 'node:assert/strict';
import test from 'node:test';

import { logSchema, managementLogListQuerySchema } from '../src/index.js';

test('logSchema accepts audit and request log records', () => {
	const parsedLog = logSchema.parse({
		id: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
		level: 'warn',
		kind: 'audit',
		message: 'Updated product profile',
		actorStaffId: 'ca7641b9-6856-42b6-99f0-f75f1a4d9e79',
		requestId: 'request-1',
		method: null,
		path: null,
		statusCode: null,
		entityType: 'product',
		entityId: 'product-1',
		metadata: {
			changedFields: ['name']
		},
		expiresAt: new Date('2026-10-04T00:00:00.000Z'),
		createdAt: new Date('2026-07-06T00:00:00.000Z')
	});

	assert.equal(parsedLog.level, 'warn');
	assert.equal(parsedLog.kind, 'audit');
});

test('managementLogListQuerySchema parses filters and pagination defaults', () => {
	const parsedQuery = managementLogListQuerySchema.parse({
		kind: 'request',
		level: 'error',
		actorStaffId: 'ca7641b9-6856-42b6-99f0-f75f1a4d9e79',
		requestId: 'request-1'
	});

	assert.equal(parsedQuery.page, 1);
	assert.equal(parsedQuery.limit, 20);
	assert.equal(parsedQuery.sort, 'createdAt');
	assert.equal(parsedQuery.order, 'desc');
});
