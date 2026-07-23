import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { createErrorHandler } from '../../src/errors/error-handler.js';
import { requestApp } from '../helpers/http.js';

test('reports unexpected request errors with request context', async () => {
	const reports: unknown[][] = [];
	const app = express();
	app.get('/failure', () => {
		throw new Error('database failed');
	});
	app.use(createErrorHandler((...args) => reports.push(args)));

	const response = await requestApp(app, {
		path: '/failure?secret=hidden',
		headers: { 'x-request-id': 'request-123' }
	});

	assert.equal(response.status, 500);
	assert.equal(reports.length, 1);
	assert.deepEqual(reports[0]?.[1], {
		requestId: 'request-123',
		method: 'GET',
		path: '/failure'
	});
	assert.match(String(reports[0]?.[2]), /database failed/);
});

test('normalizes malformed and oversized JSON parser failures', async () => {
	const reports: unknown[][] = [];
	const app = express();
	app.use(express.json({ limit: '8b' }));
	app.post('/body', (_request, response) => response.status(204).send());
	app.use(createErrorHandler((...args) => reports.push(args)));

	const malformed = await requestApp(app, {
		method: 'POST',
		path: '/body',
		headers: { 'content-type': 'application/json' },
		body: '{'
	});
	const oversized = await requestApp(app, {
		method: 'POST',
		path: '/body',
		headers: { 'content-type': 'application/json' },
		body: '{"value":true}'
	});

	assert.equal(malformed.status, 400);
	assert.equal(malformed.json<{ error: { code: string } }>().error.code, 'MALFORMED_JSON');
	assert.equal(oversized.status, 413);
	assert.equal(oversized.json<{ error: { code: string } }>().error.code, 'PAYLOAD_TOO_LARGE');
	assert.equal(reports.length, 0);
});

test('maps expected Prisma race errors without exposing database details', async () => {
	const reports: unknown[][] = [];
	const app = express();
	for (const code of ['P2002', 'P2003', 'P2025', 'P2034']) {
		app.get(`/${code}`, () => {
			throw Object.assign(new Error('sensitive database detail'), { code });
		});
	}
	app.use(createErrorHandler((...args) => reports.push(args)));

	const expectations = [
		['P2002', 409, 'RESOURCE_CONFLICT'],
		['P2003', 409, 'RELATION_CONFLICT'],
		['P2025', 404, 'RESOURCE_NOT_FOUND'],
		['P2034', 409, 'CONCURRENT_MODIFICATION']
	] as const;
	for (const [path, status, code] of expectations) {
		const response = await requestApp(app, { path: `/${path}` });
		assert.equal(response.status, status);
		assert.equal(response.json<{ error: { code: string } }>().error.code, code);
		assert.doesNotMatch(response.text(), /sensitive database detail/);
	}
	assert.equal(reports.length, 0);
});
