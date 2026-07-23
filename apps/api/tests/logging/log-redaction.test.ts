import assert from 'node:assert/strict';
import test from 'node:test';

import { redactLogValue, serializeLogError } from '../../src/logging/log-redaction.js';

test('redacts sensitive keys and secret-like text in structured values', () => {
	assert.deepEqual(
		redactLogValue({
			password: 'plain-password',
			nested: {
				authorization: 'Bearer top-secret-token',
				message: 'token=message-secret',
				jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdGFmZiJ9.signature'
			},
			connection: 'postgresql://user:db-password@localhost:5432/nrg'
		}),
		{
			password: '[REDACTED]',
			nested: {
				authorization: '[REDACTED]',
				message: 'token=[REDACTED]',
				jwt: '[REDACTED]'
			},
			connection: 'postgresql://[REDACTED]:[REDACTED]@localhost:5432/nrg'
		}
	);
});

test('serializes complete exception context while redacting free-text secrets', () => {
	const cause = new Error('authorization: Bearer cause-token');
	const error = Object.assign(new Error('database token=error-token'), {
		code: 'P2022',
		meta: {
			modelName: 'Order',
			password: 'database-password'
		},
		cause
	});

	const serialized = serializeLogError(error);

	assert.equal(serialized.name, 'Error');
	assert.equal(serialized.message, 'database token=[REDACTED]');
	assert.equal(serialized.code, 'P2022');
	assert.equal((serialized.meta as { password: string } | null)?.password, '[REDACTED]');
	assert.equal(serialized.cause?.message, 'authorization: Bearer [REDACTED]');
	assert.match(serialized.stack ?? '', /database token=\[REDACTED\]/);
	assert.doesNotMatch(JSON.stringify(serialized), /error-token|cause-token|database-password/);
});

test('redaction handles circular and deeply nested metadata without throwing', () => {
	const circular: Record<string, unknown> = {};
	circular['self'] = circular;
	let deeplyNested: unknown = 'leaf';
	for (let depth = 0; depth < 5_000; depth += 1) deeplyNested = { child: deeplyNested };

	assert.deepEqual(redactLogValue(circular), { self: '[CIRCULAR]' });
	assert.doesNotThrow(() => redactLogValue(deeplyNested));
	assert.match(JSON.stringify(redactLogValue(deeplyNested)), /TRUNCATED/);
});

test('error serialization bounds nested cause chains', () => {
	let nestedError: Error = new Error('root');
	for (let depth = 0; depth < 5_000; depth += 1) {
		nestedError = new Error(`level-${depth}`, { cause: nestedError });
	}

	let serialized: ReturnType<typeof serializeLogError> | undefined;
	assert.doesNotThrow(() => {
		serialized = serializeLogError(nestedError);
	});
	assert.match(JSON.stringify(serialized), /TruncatedError/);
});
