import type { DatabaseClient } from '@packages/database';

type DashboardMetric = {
	label: string;
	value: string;
	trend?: {
		change: string;
		reference: string;
	};
};

type DashboardTrendPoint = {
	label: string;
	value: number;
};

type DashboardRecentLog = {
	id: string;
	message: string;
	level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
	kind: 'audit' | 'request';
	createdAt: Date;
};

type DashboardMixItem = {
	label: string;
	value: number;
};

type DashboardSignal = {
	label: string;
	value: string;
	note: string;
};

type DashboardResponse = {
	metrics: DashboardMetric[];
	activityTrend: DashboardTrendPoint[];
	recentLogs: DashboardRecentLog[];
	productMix: DashboardMixItem[];
	signals: DashboardSignal[];
};

type DashboardServiceDependencies = {
	database: DatabaseClient;
	now?: () => Date;
};

function startOfDay(value: Date): Date {
	return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, dayOffset: number): Date {
	const nextDate = new Date(value);
	nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
	return nextDate;
}

function formatSignedCount(value: number): string {
	if (value > 0) {
		return `+${value}`;
	}

	return String(value);
}

export function createDashboardService(dependencies: DashboardServiceDependencies) {
	const now = dependencies.now ?? (() => new Date());

	return {
		async getDashboard(): Promise<DashboardResponse> {
			const currentTimestamp = now();
			const today = startOfDay(currentTimestamp);
			const thirtyDaysAgo = addDays(today, -30);
			const sixtyDaysAgo = addDays(today, -60);
			const activityWindowStart = addDays(today, -6);
			const activityBuckets = Array.from({ length: 7 }, (_, index) => {
				const bucketStart = addDays(activityWindowStart, index);
				const bucketEnd = addDays(bucketStart, 1);
				return {
					label: new Intl.DateTimeFormat('zh-TW', {
						month: 'numeric',
						day: 'numeric'
					}).format(bucketStart),
					range: {
						gte: bucketStart,
						lt: bucketEnd
					}
				};
			});

			const [
				totalProducts,
				publishedProducts,
				uncategorizedProducts,
				totalStaff,
				activeStaff,
				recentLogCount,
				previousLogCount,
				recentProductCount,
				previousProductCount,
				recentStaffCount,
				recentErrorCount,
				recentAuditCount,
				recentLogs,
				activityTrend
			] = await Promise.all([
				dependencies.database.product.count({
					where: {
						deletedAt: null
					}
				}),
				dependencies.database.product.count({
					where: {
						deletedAt: null,
						published: true
					}
				}),
				dependencies.database.product.count({
					where: {
						deletedAt: null,
						categoryId: null
					}
				}),
				dependencies.database.staff.count({
					where: {
						deletedAt: null
					}
				}),
				dependencies.database.staff.count({
					where: {
						deletedAt: null,
						status: 'active'
					}
				}),
				dependencies.database.log.count({
					where: {
						expiresAt: {
							gt: currentTimestamp
						},
						createdAt: {
							gte: thirtyDaysAgo
						}
					}
				}),
				dependencies.database.log.count({
					where: {
						expiresAt: {
							gt: currentTimestamp
						},
						createdAt: {
							gte: sixtyDaysAgo,
							lt: thirtyDaysAgo
						}
					}
				}),
				dependencies.database.product.count({
					where: {
						deletedAt: null,
						createdAt: {
							gte: thirtyDaysAgo
						}
					}
				}),
				dependencies.database.product.count({
					where: {
						deletedAt: null,
						createdAt: {
							gte: sixtyDaysAgo,
							lt: thirtyDaysAgo
						}
					}
				}),
				dependencies.database.staff.count({
					where: {
						deletedAt: null,
						createdAt: {
							gte: thirtyDaysAgo
						}
					}
				}),
				dependencies.database.log.count({
					where: {
						expiresAt: {
							gt: currentTimestamp
						},
						level: {
							in: ['error', 'fatal']
						},
						createdAt: {
							gte: thirtyDaysAgo
						}
					}
				}),
				dependencies.database.log.count({
					where: {
						expiresAt: {
							gt: currentTimestamp
						},
						kind: 'audit',
						createdAt: {
							gte: thirtyDaysAgo
						}
					}
				}),
				dependencies.database.log.findMany({
					where: {
						expiresAt: {
							gt: currentTimestamp
						}
					},
					orderBy: {
						createdAt: 'desc'
					},
					take: 5,
					select: {
						id: true,
						message: true,
						level: true,
						kind: true,
						createdAt: true
					}
				}),
				Promise.all(
					activityBuckets.map(async (bucket) => ({
						label: bucket.label,
						value: await dependencies.database.log.count({
							where: {
								expiresAt: {
									gt: currentTimestamp
								},
								createdAt: bucket.range
							}
						})
					}))
				)
			]);

			const draftProducts = totalProducts - publishedProducts;

			return {
				metrics: [
					{
						label: '商品總數',
						value: String(totalProducts),
						trend: {
							change: `近 30 天新增 ${recentProductCount}`,
							reference: '商品資料'
						}
					},
					{
						label: '已上架商品',
						value: String(publishedProducts),
						trend: {
							change: `草稿 ${draftProducts}`,
							reference: '目前狀態'
						}
					},
					{
						label: '啟用人員',
						value: String(activeStaff),
						trend: {
							change: `總人數 ${totalStaff}`,
							reference: '人員帳號'
						}
					},
					{
						label: '近 30 天日誌',
						value: String(recentLogCount),
						trend: {
							change: formatSignedCount(recentLogCount - previousLogCount),
							reference: '較前 30 天'
						}
					}
				],
				activityTrend,
				recentLogs,
				productMix: [
					{ label: '已上架', value: publishedProducts },
					{ label: '草稿', value: draftProducts },
					{ label: '未分類', value: uncategorizedProducts }
				],
				signals: [
					{
						label: '新增商品',
						value: String(recentProductCount),
						note: `較前 30 天 ${formatSignedCount(recentProductCount - previousProductCount)}`
					},
					{
						label: '新增人員',
						value: String(recentStaffCount),
						note: '近 30 天建立'
					},
					{
						label: '稽核日誌',
						value: String(recentAuditCount),
						note: '近 30 天紀錄'
					},
					{
						label: '錯誤日誌',
						value: String(recentErrorCount),
						note: '近 30 天事件'
					}
				]
			};
		}
	};
}

export type DashboardService = ReturnType<typeof createDashboardService>;
