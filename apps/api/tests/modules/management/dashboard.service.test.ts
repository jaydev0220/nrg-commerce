import assert from 'node:assert/strict';
import test from 'node:test';

import { createDashboardService } from '../../../src/modules/management/dashboard/dashboard.service.js';

function decimal(value: number) {
	return { toString: () => String(value) };
}

function createDatabase(orders: unknown[]) {
	return {
		order: {
			findMany: async (args: { where: { completedAt: { gte: Date; lt: Date } } }) =>
				orders.filter((order) => {
					const item = order as { completedAt: Date };
					return (
						item.completedAt >= args.where.completedAt.gte &&
						item.completedAt < args.where.completedAt.lt
					);
				})
		}
	} as unknown as Parameters<typeof createDashboardService>[0]['database'];
}

test('dashboard uses completed sales, UTC+8 month boundaries, and comparison references', async () => {
	const database = createDatabase([
		{
			createdAt: new Date('2026-07-31T16:10:00.000Z'),
			completedAt: new Date('2026-07-31T16:10:00.000Z'),
			totalAmount: decimal(1000),
			businessId: 'business-1',
			items: [{ productName: '產品 A', lineTotal: decimal(1000) }]
		},
		{
			createdAt: new Date('2026-06-30T15:10:00.000Z'),
			completedAt: new Date('2026-06-30T15:10:00.000Z'),
			totalAmount: decimal(500),
			businessId: null
		}
	]);
	const service = createDashboardService({
		database,
		now: () => new Date('2026-07-31T16:30:00.000Z')
	});

	const dashboard = await service.getDashboard();

	assert.deepEqual(dashboard.metrics, [
		{
			key: 'completedSales',
			value: 1000,
			comparison: 100,
			comparisonKind: 'percent',
			reference: 'previousMonth'
		},
		{
			key: 'completedOrders',
			value: 1,
			comparison: 100,
			comparisonKind: 'percent',
			reference: 'previousMonth'
		},
		{
			key: 'businessSalesShare',
			value: 100,
			comparison: 100,
			comparisonKind: 'percentagePoint',
			reference: 'previousMonth'
		}
	]);
	assert.equal(dashboard.trend.series.length, 3);
	assert.equal(dashboard.trend.series[0]?.points.length, 30);
	assert.equal(dashboard.trend.series[0]?.points.at(-1)?.value, 1000);
	assert.equal(dashboard.trend.series[1]?.points.at(-1)?.value, 1000);
	assert.equal(dashboard.trend.series[2]?.points.at(-1)?.value, 0);
	assert.deepEqual(dashboard.topProducts, [{ name: '產品 A', value: 1000, share: 100 }]);
});

test('dashboard creates monthly and quarterly windows with total, business, and consumer series', async () => {
	const database = createDatabase([
		{
			createdAt: new Date('2026-07-01T01:00:00.000Z'),
			completedAt: new Date('2026-07-01T01:00:00.000Z'),
			totalAmount: decimal(200),
			businessId: 'business-1'
		},
		{
			createdAt: new Date('2026-04-01T01:00:00.000Z'),
			completedAt: new Date('2026-04-01T01:00:00.000Z'),
			totalAmount: decimal(300),
			businessId: null
		}
	]);
	const service = createDashboardService({
		database,
		now: () => new Date('2026-07-13T02:00:00.000Z')
	});

	const monthly = await service.getDashboard('months');
	const quarterly = await service.getDashboard('quarters');

	assert.equal(monthly.trend.range, 'months');
	assert.equal(monthly.trend.series[0]?.points.length, 12);
	assert.equal(monthly.trend.series[0]?.points.at(-1)?.value, 200);
	assert.equal(quarterly.trend.range, 'quarters');
	assert.equal(quarterly.trend.series[0]?.points.length, 8);
	assert.equal(quarterly.trend.series[0]?.points.at(-1)?.value, 200);
});
