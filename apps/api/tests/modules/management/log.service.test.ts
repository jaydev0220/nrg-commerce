import assert from 'node:assert/strict';
import test from 'node:test';

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

test('pruneExpiredLogs deletes rows using the current time', async () => {
	let pruneInputNow: Date | undefined;
	const logService = createLogService({
		repository: {
			listLogs: async () => ({ data: [], total: 0 }),
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
