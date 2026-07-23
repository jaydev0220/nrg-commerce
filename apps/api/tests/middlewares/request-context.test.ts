import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import {
	createRequestContextMiddleware,
	getRequestContext
} from '../../src/middlewares/request-context.js';
import { requestApp } from '../helpers/http.js';

function createApp(createId: () => string) {
	const app = express();
	app.use(createRequestContextMiddleware(createId));
	app.get('/', (request, response) =>
		response.status(200).json(getRequestContext(request, response))
	);
	return app;
}

test('preserves a bounded external request identifier', async () => {
	const response = await requestApp(
		createApp(() => 'generated-id'),
		{
			path: '/',
			headers: { 'x-request-id': 'edge.request-123:attempt_2' }
		}
	);

	assert.equal(response.headers['x-request-id'], 'edge.request-123:attempt_2');
	assert.deepEqual(response.json(), { requestId: 'edge.request-123:attempt_2' });
});

test('replaces malformed or oversized external request identifiers', async () => {
	const malformed = await requestApp(
		createApp(() => 'generated-malformed'),
		{
			path: '/',
			headers: { 'x-request-id': '<script>alert(1)</script>' }
		}
	);
	const oversized = await requestApp(
		createApp(() => 'generated-oversized'),
		{
			path: '/',
			headers: { 'x-request-id': 'a'.repeat(129) }
		}
	);

	assert.equal(malformed.headers['x-request-id'], 'generated-malformed');
	assert.equal(oversized.headers['x-request-id'], 'generated-oversized');
});
