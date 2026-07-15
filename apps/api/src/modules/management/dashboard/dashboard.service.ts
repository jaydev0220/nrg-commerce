import type { DatabaseClient } from '@packages/database';

export type DashboardRange = 'days' | 'months' | 'quarters';

type DashboardMetric = {
	key: 'completedSales' | 'completedOrders' | 'businessSalesShare';
	value: number;
	comparison: number;
	comparisonKind: 'percent' | 'percentagePoint';
	reference: 'previousMonth';
};

type DashboardTrendPoint = {
	startAt: Date;
	label: string;
	value: number;
};

type DashboardTrendSeries = {
	key: 'total' | 'business' | 'consumer';
	points: DashboardTrendPoint[];
};

type DashboardTopProduct = {
	name: string;
	value: number;
	share: number;
};

type DashboardResponse = {
	metrics: DashboardMetric[];
	trend: {
		range: DashboardRange;
		series: DashboardTrendSeries[];
	};
	topProducts: DashboardTopProduct[];
};

type DashboardServiceDependencies = {
	database: DatabaseClient;
	now?: () => Date;
};

type SalesOrder = {
	completedAt: Date;
	totalAmount: { toString(): string };
	businessId: string | null;
	subtotalAmount?: { toString(): string };
	discountAmount?: { toString(): string };
	items?: Array<{
		productName: string;
		lineTotal: { toString(): string };
	}>;
};

const timezoneOffsetMs = 8 * 60 * 60 * 1000;
const completedStatus = 'completed' as const;

function localDateParts(value: Date) {
	const shifted = new Date(value.getTime() + timezoneOffsetMs);
	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth(),
		day: shifted.getUTCDate()
	};
}

function localBoundary(year: number, month: number, day: number): Date {
	return new Date(Date.UTC(year, month, day) - timezoneOffsetMs);
}

function addMonths(value: { year: number; month: number }, amount: number) {
	const date = new Date(Date.UTC(value.year, value.month + amount, 1));
	return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function roundMoney(value: number): number {
	return Math.round(value * 100) / 100;
}

function percentageChange(current: number, previous: number): number {
	if (previous === 0) return current === 0 ? 0 : 100;
	return Math.round(((current - previous) / previous) * 10000) / 100;
}

function percentagePointChange(current: number, previous: number): number {
	return Math.round((current - previous) * 100) / 100;
}

function amount(order: SalesOrder): number {
	return Number(order.totalAmount.toString());
}

function sumAmount(orders: SalesOrder[]): number {
	return roundMoney(orders.reduce((sum, order) => sum + amount(order), 0));
}

function rangeWindow(range: DashboardRange, current: Date) {
	const parts = localDateParts(current);
	if (range === 'days') {
		return {
			start: localBoundary(parts.year, parts.month, parts.day - 29),
			end: localBoundary(parts.year, parts.month, parts.day + 1),
			count: 30
		};
	}
	if (range === 'months') {
		const start = addMonths(parts, -11);
		const end = addMonths(parts, 1);
		return {
			start: localBoundary(start.year, start.month, 1),
			end: localBoundary(end.year, end.month, 1),
			count: 12
		};
	}
	const quarterStartMonth = Math.floor(parts.month / 3) * 3;
	const start = addMonths({ year: parts.year, month: quarterStartMonth }, -21);
	const end = addMonths({ year: parts.year, month: quarterStartMonth }, 3);
	return {
		start: localBoundary(start.year, start.month, 1),
		end: localBoundary(end.year, end.month, 1),
		count: 8
	};
}

function bucketBoundary(range: DashboardRange, current: Date, index: number): Date {
	const parts = localDateParts(current);
	if (range === 'days') return localBoundary(parts.year, parts.month, parts.day - 29 + index);
	if (range === 'months') {
		const start = addMonths(parts, -11 + index);
		return localBoundary(start.year, start.month, 1);
	}
	const quarterStartMonth = Math.floor(parts.month / 3) * 3;
	const start = addMonths({ year: parts.year, month: quarterStartMonth }, -21 + index * 3);
	return localBoundary(start.year, start.month, 1);
}

function bucketLabel(range: DashboardRange, start: Date): string {
	const parts = localDateParts(start);
	if (range === 'days') return `${parts.month + 1}/${parts.day}`;
	if (range === 'months') return `${parts.year}/${parts.month + 1}`;
	return `${parts.year} Q${Math.floor(parts.month / 3) + 1}`;
}

function orderInBucket(order: SalesOrder, start: Date, end: Date): boolean {
	return order.completedAt >= start && order.completedAt < end;
}

function netProductAmount(order: SalesOrder, lineTotal: number): number {
	const subtotal = order.subtotalAmount
		? Number(order.subtotalAmount.toString())
		: sumAmount([order]);
	const discount = order.discountAmount ? Number(order.discountAmount.toString()) : 0;
	if (subtotal <= 0) return lineTotal;
	return roundMoney((lineTotal * Math.max(0, subtotal - discount)) / subtotal);
}

export function createDashboardService(dependencies: DashboardServiceDependencies) {
	const now = dependencies.now ?? (() => new Date());

	return {
		async getDashboard(range: DashboardRange = 'days'): Promise<DashboardResponse> {
			const current = now();
			const currentParts = localDateParts(current);
			const currentMonthStart = localBoundary(currentParts.year, currentParts.month, 1);
			const nextMonth = addMonths(currentParts, 1);
			const nextMonthStart = localBoundary(nextMonth.year, nextMonth.month, 1);
			const previousMonth = addMonths(currentParts, -1);
			const previousMonthStart = localBoundary(previousMonth.year, previousMonth.month, 1);
			const window = rangeWindow(range, current);

			const [currentOrders, previousOrders, trendOrders] = (await Promise.all([
				dependencies.database.order.findMany({
					where: {
						status: completedStatus,
						completedAt: { gte: currentMonthStart, lt: nextMonthStart }
					},
					include: { items: true },
					orderBy: { completedAt: 'asc' }
				}),
				dependencies.database.order.findMany({
					where: {
						status: completedStatus,
						completedAt: { gte: previousMonthStart, lt: currentMonthStart }
					},
					select: { completedAt: true, totalAmount: true, businessId: true }
				}),
				dependencies.database.order.findMany({
					where: { status: completedStatus, completedAt: { gte: window.start, lt: window.end } },
					select: { completedAt: true, totalAmount: true, businessId: true }
				})
			])) as [SalesOrder[], SalesOrder[], SalesOrder[]];

			const currentSales = sumAmount(currentOrders);
			const previousSales = sumAmount(previousOrders);
			const currentBusinessSales = sumAmount(currentOrders.filter((order) => order.businessId));
			const previousBusinessSales = sumAmount(previousOrders.filter((order) => order.businessId));
			const currentBusinessShare = currentSales ? (currentBusinessSales / currentSales) * 100 : 0;
			const previousBusinessShare = previousSales
				? (previousBusinessSales / previousSales) * 100
				: 0;

			const series = (key: DashboardTrendSeries['key']): DashboardTrendSeries => ({
				key,
				points: Array.from({ length: window.count }, (_, index) => {
					const start = bucketBoundary(range, current, index);
					const end = bucketBoundary(range, current, index + 1);
					const bucketOrders = trendOrders.filter((order) => orderInBucket(order, start, end));
					const value =
						key === 'total'
							? sumAmount(bucketOrders)
							: sumAmount(
									bucketOrders.filter((order) =>
										key === 'business' ? order.businessId : !order.businessId
									)
								);
					return { startAt: start, label: bucketLabel(range, start), value };
				})
			});

			const productTotals = new Map<string, number>();
			for (const order of currentOrders) {
				for (const item of order.items ?? []) {
					const lineTotal = Number(item.lineTotal.toString());
					productTotals.set(
						item.productName,
						(productTotals.get(item.productName) ?? 0) + netProductAmount(order, lineTotal)
					);
				}
			}
			const topProducts = [...productTotals.entries()]
				.sort((left, right) => right[1] - left[1])
				.slice(0, 5)
				.map(([name, value]) => ({
					name,
					value: roundMoney(value),
					share: currentSales ? Math.round((value / currentSales) * 10000) / 100 : 0
				}));

			return {
				metrics: [
					{
						key: 'completedSales',
						value: currentSales,
						comparison: percentageChange(currentSales, previousSales),
						comparisonKind: 'percent',
						reference: 'previousMonth'
					},
					{
						key: 'completedOrders',
						value: currentOrders.length,
						comparison: percentageChange(currentOrders.length, previousOrders.length),
						comparisonKind: 'percent',
						reference: 'previousMonth'
					},
					{
						key: 'businessSalesShare',
						value: Math.round(currentBusinessShare * 100) / 100,
						comparison: percentagePointChange(currentBusinessShare, previousBusinessShare),
						comparisonKind: 'percentagePoint',
						reference: 'previousMonth'
					}
				],
				trend: {
					range,
					series: [series('total'), series('business'), series('consumer')]
				},
				topProducts
			};
		}
	};
}

export type DashboardService = ReturnType<typeof createDashboardService>;
