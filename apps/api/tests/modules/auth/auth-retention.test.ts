import assert from 'node:assert/strict';
import test from 'node:test';

import {
	authSessionRetentionDays,
	pruneExpiredAuthSessions,
	startAuthSessionRetentionPruner
} from '../../../src/modules/auth/auth-retention.js';

const fixedNow = new Date('2026-07-22T00:00:00.000Z');

test('pruneExpiredAuthSessions removes sessions past the retention window', async () => {
	let receivedCutoff: Date | undefined;
	const count = await pruneExpiredAuthSessions(
		{
			pruneExpiredSessions: async (cutoff) => {
				receivedCutoff = cutoff;
				return 3;
			}
		},
		fixedNow
	);

	assert.equal(count, 3);
	assert.equal(
		receivedCutoff?.toISOString(),
		new Date(fixedNow.getTime() - authSessionRetentionDays * 24 * 60 * 60 * 1_000).toISOString()
	);
});

test('auth session retention reports background failures and can be stopped', async () => {
	let resolveError: ((error: unknown) => void) | undefined;
	const reportedError = new Promise<unknown>((resolve) => {
		resolveError = resolve;
	});
	const failure = new Error('database unavailable');
	const pruner = startAuthSessionRetentionPruner({
		repository: {
			pruneExpiredSessions: async () => {
				throw failure;
			}
		},
		now: () => fixedNow,
		onError: (error) => resolveError?.(error)
	});

	assert.equal(await reportedError, failure);
	pruner.stop();
});
