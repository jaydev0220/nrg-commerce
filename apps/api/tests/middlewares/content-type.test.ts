import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { errorHandler } from '../../src/errors/error-handler.js';
import { requireJsonRequestBody } from '../../src/middlewares/content-type.js';
import { requestApp } from '../helpers/http.js';

function createApp() {
	const app = express();
	app.use(requireJsonRequestBody);
	app.use(express.json());
	app.post('/body', (request, response) => response.status(200).json(request.body));
	app.use(errorHandler);
	return app;
}

test('accepts JSON request bodies and bodyless requests', async () => {
	const app = createApp();
	const jsonResponse = await requestApp(app, {
		method: 'POST',
		path: '/body',
		headers: { 'content-type': 'application/json; charset=utf-8' },
		body: '{"accepted":true}'
	});
	const bodylessResponse = await requestApp(app, {
		method: 'POST',
		path: '/body'
	});

	assert.equal(jsonResponse.status, 200);
	assert.deepEqual(jsonResponse.json(), { accepted: true });
	assert.equal(bodylessResponse.status, 200);
});

test('rejects non-JSON request bodies', async () => {
	const response = await requestApp(createApp(), {
		method: 'POST',
		path: '/body',
		headers: { 'content-type': 'text/plain' },
		body: 'not-json'
	});

	assert.equal(response.status, 415);
	assert.equal(response.json<{ error: { code: string } }>().error.code, 'UNSUPPORTED_MEDIA_TYPE');
});
