import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { createHealthRouter } from '../../src/health/health.routes.js';
import { requestApp } from '../helpers/http.js';

test('readiness caches healthy and unhealthy probes for five seconds', async () => {
	let now = 0;
	let probes = 0;
	const app = express();
	app.use(
		'/health',
		createHealthRouter({
			isReady: async () => {
				probes += 1;
				return probes === 1;
			},
			now: () => now
		})
	);

	const first = await requestApp(app, { path: '/health/readiness' });
	const second = await requestApp(app, { path: '/health/readiness' });
	assert.equal(first.status, 200);
	assert.equal(second.status, 200);
	assert.equal(probes, 1);
	assert.equal(first.headers['cache-control'], 'no-store');

	now = 5_000;
	const expired = await requestApp(app, { path: '/health/readiness' });
	assert.equal(expired.status, 503);
	assert.deepEqual(expired.json(), { status: 'not_ready' });
	assert.equal(probes, 2);
});

test('readiness converts probe errors to a cached not-ready result', async () => {
	let probes = 0;
	const app = express();
	app.use(
		'/health',
		createHealthRouter({
			isReady: async () => {
				probes += 1;
				throw new Error('database unavailable');
			}
		})
	);

	const first = await requestApp(app, { path: '/health/readiness' });
	const second = await requestApp(app, { path: '/health/readiness' });
	assert.equal(first.status, 503);
	assert.equal(second.status, 503);
	assert.equal(probes, 1);
});

test('liveness does not call the readiness probe', async () => {
	let probes = 0;
	const app = express();
	app.use(
		'/health',
		createHealthRouter({
			isReady: async () => {
				probes += 1;
				return true;
			}
		})
	);

	const response = await requestApp(app, { path: '/health/liveness' });
	assert.equal(response.status, 200);
	assert.deepEqual(response.json(), { status: 'ok' });
	assert.equal(probes, 0);
	assert.equal(response.headers['cache-control'], 'no-store');
});
