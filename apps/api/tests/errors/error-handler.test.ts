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
