import { Router } from 'express';
import { dashboardRangeResponseSchema, dashboardResponseSchema, z } from '@packages/schemas';
import { parseQuery, sendJson } from '../http/validation.js';
import type { MockState } from '../state.js';
import { assertDomainHealthy } from './shared.js';

const dashboardQuerySchema = z.object({
	range: dashboardRangeResponseSchema.default('days')
});

function completedOrders(state: MockState) {
	return state.orders.filter((order) => order.status === 'completed');
}

function trendStarts(range: 'days' | 'months' | 'quarters'): Date[] {
	const base = new Date('2026-07-19T00:00:00.000Z');
	const count = range === 'days' ? 7 : range === 'months' ? 6 : 4;
	return Array.from({ length: count }, (_, index) => {
		const date = new Date(base);
		if (range === 'days') date.setUTCDate(base.getUTCDate() - (count - 1 - index));
		if (range === 'months') date.setUTCMonth(base.getUTCMonth() - (count - 1 - index), 1);
		if (range === 'quarters') date.setUTCMonth(base.getUTCMonth() - 3 * (count - 1 - index), 1);
		return date;
	});
}

function trendLabel(date: Date, range: 'days' | 'months' | 'quarters'): string {
	if (range === 'days') return date.toISOString().slice(5, 10);
	if (range === 'months') return date.toISOString().slice(0, 7);
	return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export function createDashboardRouter(state: MockState): Router {
	const router = Router();

	router.get('/', (request, response) => {
		assertDomainHealthy(state, 'dashboard');
		const { range } = parseQuery(request, dashboardQuerySchema);
		const completed = completedOrders(state);
		const completedSales = completed.reduce((sum, order) => sum + order.totalAmount, 0);
		const businessSales = completed
			.filter((order) => order.businessId !== null)
			.reduce((sum, order) => sum + order.totalAmount, 0);
		const businessSalesShare = completedSales === 0 ? 0 : (businessSales / completedSales) * 100;
		const starts = trendStarts(range);
		const seriesKeys = ['total', 'business', 'consumer'] as const;
		const trendSeries = seriesKeys.map((key) => ({
			key,
			points: starts.map((startAt, index) => ({
				startAt,
				label: trendLabel(startAt, range),
				value:
					completed.length === 0
						? 0
						: Math.round(
								(completedSales / starts.length) *
									(key === 'total'
										? 1
										: key === 'business'
											? businessSalesShare / 100
											: 1 - businessSalesShare / 100) *
									((index + 1) / starts.length) *
									100
							) / 100
			}))
		}));
		const productSales = new Map<string, number>();
		for (const order of completed) {
			for (const item of order.items) {
				productSales.set(
					item.productName,
					(productSales.get(item.productName) ?? 0) + item.lineTotal
				);
			}
		}
		const productTotal = [...productSales.values()].reduce((sum, value) => sum + value, 0);
		const topProducts = [...productSales.entries()]
			.sort((left, right) => right[1] - left[1])
			.slice(0, 5)
			.map(([name, value]) => ({
				name,
				value,
				share: productTotal === 0 ? 0 : (value / productTotal) * 100
			}));

		sendJson(response, dashboardResponseSchema, {
			metrics: [
				{
					key: 'completedSales',
					value: completedSales,
					comparison: 12.5,
					comparisonKind: 'percent',
					reference: 'previousMonth'
				},
				{
					key: 'completedOrders',
					value: completed.length,
					comparison: 8.3,
					comparisonKind: 'percent',
					reference: 'previousMonth'
				},
				{
					key: 'businessSalesShare',
					value: businessSalesShare,
					comparison: 2.1,
					comparisonKind: 'percentagePoint',
					reference: 'previousMonth'
				}
			],
			trend: { range, series: trendSeries },
			topProducts
		});
	});

	return router;
}
