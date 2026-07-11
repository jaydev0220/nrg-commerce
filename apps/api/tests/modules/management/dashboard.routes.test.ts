import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { createDashboardRouter } from '../../../src/modules/management/dashboard/dashboard.routes.js';
import { requestApp } from '../../helpers/http.js';

test('management dashboard route returns dashboard aggregates', async () => {
	const app = express();

	app.use(
		'/api/management/dashboard',
		createDashboardRouter({
			dashboardService: {
				getDashboard: async () => ({
					metrics: [
						{
							label: '商品總數',
							value: '12',
							trend: {
								change: '+2',
								reference: '較前 7 日'
							}
						}
					],
					activityTrend: [{ label: '07/08', value: 5 }],
					recentLogs: [
						{
							id: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
							level: 'info',
							kind: 'audit',
							message: 'Staff updated a product.',
							createdAt: new Date('2026-07-08T00:00:00.000Z')
						}
					],
					productMix: [{ label: '已上架', value: 8 }],
					signals: [{ label: '近 7 日錯誤', value: '1', note: '需持續觀察' }]
				})
			}
		})
	);

	const response = await requestApp(app, {
		path: '/api/management/dashboard'
	});
	const payload = response.json<{
		metrics: Array<{ label: string; value: string }>;
		activityTrend: Array<{ label: string; value: number }>;
		recentLogs: Array<{ id: string; level: string; kind: string }>;
		productMix: Array<{ label: string; value: number }>;
		signals: Array<{ label: string; value: string; note: string }>;
	}>();

	assert.equal(response.status, 200, response.text());
	assert.deepEqual(payload.metrics, [
		{
			label: '商品總數',
			value: '12',
			trend: {
				change: '+2',
				reference: '較前 7 日'
			}
		}
	]);
	assert.deepEqual(payload.activityTrend, [{ label: '07/08', value: 5 }]);
	assert.equal(payload.recentLogs[0]?.kind, 'audit');
	assert.deepEqual(payload.productMix, [{ label: '已上架', value: 8 }]);
	assert.deepEqual(payload.signals, [{ label: '近 7 日錯誤', value: '1', note: '需持續觀察' }]);
});
