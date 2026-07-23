import assert from 'node:assert/strict';
import test from 'node:test';

import {
	fetchWithTimeout,
	readBoundedJson,
	requiredSecret
} from '../../../scripts/operations/http-operations.mjs';

test('operational HTTP requests reject redirects before forwarding sensitive data', async () => {
	let receivedInit;
	await fetchWithTimeout(
		async (_input, init) => {
			receivedInit = init;
			return new Response(null, { status: 200 });
		},
		'https://api.example.com',
		{ headers: { cookie: 'private' }, redirect: 'follow' },
		1000
	);

	assert.equal(receivedInit.redirect, 'error');
});

test('bounded JSON parsing rejects oversized bodies before consuming the full stream', async () => {
	let cancelled = false;
	const response = {
		headers: new Headers(),
		body: new ReadableStream({
			pull(controller) {
				controller.enqueue(new TextEncoder().encode('{"value":"too large"}'));
			},
			cancel() {
				cancelled = true;
			}
		})
	};

	await assert.rejects(() => readBoundedJson(response, 8), /exceeded/u);
	assert.equal(cancelled, true);
});

test('secret parsing preserves valid whitespace and never places the value in errors', () => {
	const errors = [];
	assert.equal(
		requiredSecret({ PASSWORD: ' leading and trailing ' }, 'PASSWORD', errors),
		' leading and trailing '
	);
	assert.deepEqual(errors, []);

	const invalidErrors = [];
	assert.equal(requiredSecret({ PASSWORD: 'private\nvalue' }, 'PASSWORD', invalidErrors), '');
	assert.equal(invalidErrors.length, 1);
	assert.doesNotMatch(invalidErrors[0], /private|value/u);
});
