import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { createDashboardRouter } from '../../../src/modules/management/dashboard/dashboard.routes.js';
import { requestApp } from '../../helpers/http.js';

test('management dashboard route forwards the selected range', async () => {
	const app = express();
	const calls: Array<'days' | 'months' | 'quarters' | undefined> = [];

	app.use(
		'/api/management/dashboard',
		createDashboardRouter({
			dashboardService: {
				getDashboard: async (range) => {
					calls.push(range);
					return {
						metrics: [],
						trend: { range: range ?? 'days', series: [] },
						topProducts: []
					};
				}
			}
		})
	);

	const response = await requestApp(app, {
		path: '/api/management/dashboard?range=months'
	});
	const payload = response.json<{
		trend: { range: string };
		metrics: unknown[];
		topProducts: unknown[];
	}>();

	assert.equal(response.status, 200, response.text());
	assert.deepEqual(calls, ['months']);
	assert.equal(payload.trend.range, 'months');
	assert.deepEqual(payload.metrics, []);
	assert.deepEqual(payload.topProducts, []);
});

test('management dashboard route defaults to daily range', async () => {
	const app = express();
	let requestedRange: string | undefined;

	app.use(
		'/api/management/dashboard',
		createDashboardRouter({
			dashboardService: {
				getDashboard: async (range) => {
					requestedRange = range;
					return {
						metrics: [],
						trend: { range: range ?? 'days', series: [] },
						topProducts: []
					};
				}
			}
		})
	);

	const response = await requestApp(app, { path: '/api/management/dashboard' });

	assert.equal(response.status, 200, response.text());
	assert.equal(requestedRange, 'days');
});
