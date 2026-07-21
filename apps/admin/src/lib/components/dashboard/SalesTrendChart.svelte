<script lang="ts">
	import type { DashboardData, DashboardTrendSeries } from '$lib/api/admin-api';
	import { formatDateTime } from '$lib/api/admin-api';

	let { trend }: { trend: DashboardData['trend'] } = $props();

	const chartWidth = 960;
	const chartHeight = 320;
	const plotLeft = 48;
	const plotRight = 928;
	const plotTop = 28;
	const plotBottom = 264;
	const seriesColors: Record<DashboardTrendSeries['key'], string> = {
		total: 'var(--color-brand)',
		business: 'var(--color-success)',
		consumer: 'var(--color-warning)'
	};
	const seriesLabels: Record<DashboardTrendSeries['key'], string> = {
		total: '全部銷售',
		business: '企業客戶',
		consumer: '一般消費者'
	};
	const seriesOrder = ['total', 'business', 'consumer'] as const;
	type ActiveBucket = { index: number; label: string; timestamp: number };

	let activeBucket = $state<ActiveBucket | null>(null);

	const pointCount = $derived(trend.series[0]?.points.length ?? 0);
	const maxValue = $derived(
		Math.max(1, ...trend.series.flatMap((series) => series.points.map((point) => point.value)))
	);
	const activeTrend = $derived.by(() => {
		if (!activeBucket) return null;

		return {
			...activeBucket,
			x: chartX(activeBucket.index),
			values: seriesOrder.map((key) => ({
				key,
				value: trend.series
					.find((series) => series.key === key)
					?.points.find((point) => point.startAt.getTime() === activeBucket?.timestamp)?.value
			}))
		};
	});
	const tooltipAlignment = $derived(
		activeTrend?.index === 0
			? 'translate-x-0'
			: activeTrend?.index === pointCount - 1
				? '-translate-x-full'
				: '-translate-x-1/2'
	);

	function chartX(index: number): number {
		return plotLeft + (index / Math.max(pointCount - 1, 1)) * (plotRight - plotLeft);
	}

	function chartY(value: number): number {
		return plotBottom - (value / maxValue) * (plotBottom - plotTop);
	}

	function linePoints(series: DashboardTrendSeries): string {
		return series.points.map((point, index) => `${chartX(index)},${chartY(point.value)}`).join(' ');
	}

	function formatMoney(value: number): string {
		return new Intl.NumberFormat('zh-TW', {
			style: 'currency',
			currency: 'TWD',
			maximumFractionDigits: 0
		}).format(value);
	}

	function activateBucket(index: number, label: string, startAt: Date): void {
		activeBucket = { index, label, timestamp: startAt.getTime() };
	}

	function bucketAccessibleLabel(label: string, startAt: Date): string {
		const timestamp = startAt.getTime();
		const values = seriesOrder.map((key) => {
			const value = trend.series
				.find((series) => series.key === key)
				?.points.find((point) => point.startAt.getTime() === timestamp)?.value;
			return `${seriesLabels[key]} ${value === undefined ? '無資料' : formatMoney(value)}`;
		});

		return `${label}，${values.join('，')}`;
	}
</script>

<div class="mb-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-muted">
	{#each trend.series as series (series.key)}
		<span class="inline-flex items-center gap-2">
			<span
				class="size-2.5 rounded-full"
				style={`background: ${seriesColors[series.key]}`}
			></span>
			{seriesLabels[series.key]}
		</span>
	{/each}
</div>

<div class="overflow-x-auto">
	<div class="relative min-w-[60rem]">
		{#if activeTrend}
			<div
				id="sales-trend-tooltip"
				class={`pointer-events-none absolute top-2 z-10 w-52 rounded-md border border-border bg-bg-surface px-3 py-2 shadow-sm ${tooltipAlignment}`}
				style={`left: ${(activeTrend.x / chartWidth) * 100}%;`}
				role="tooltip"
			>
				<p class="text-xs font-semibold text-text-muted">{activeTrend.label}</p>
				<dl class="mt-2 space-y-1.5">
					{#each activeTrend.values as item (item.key)}
						<div class="flex items-center justify-between gap-4 text-sm">
							<dt class="inline-flex items-center gap-2 text-text-muted">
								<span
									class="size-2.5 shrink-0 rounded-full"
									style={`background: ${seriesColors[item.key]}`}
								></span>
								{seriesLabels[item.key]}
							</dt>
							<dd class="font-medium text-text-heading">
								{item.value === undefined ? '—' : formatMoney(item.value)}
							</dd>
						</div>
					{/each}
				</dl>
				<p class="mt-2 text-xs text-text-muted">
					{formatDateTime(new Date(activeTrend.timestamp))}
				</p>
			</div>
		{/if}
		<svg
			viewBox={`0 0 ${chartWidth} ${chartHeight}`}
			class="block h-80 w-full"
			role="img"
		>
			{#each [0, 0.25, 0.5, 0.75, 1] as ratio (ratio)}
				<line
					x1={plotLeft}
					x2={plotRight}
					y1={plotBottom - ratio * (plotBottom - plotTop)}
					y2={plotBottom - ratio * (plotBottom - plotTop)}
					class="stroke-border"
				/>
			{/each}
			{#each trend.series as series (series.key)}
				<polyline
					points={linePoints(series)}
					fill="none"
					stroke={seriesColors[series.key]}
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				{#each series.points as point, index (`${series.key}-${point.startAt.toISOString()}`)}
					<circle
						cx={chartX(index)}
						cy={chartY(point.value)}
						r="4"
						fill={seriesColors[series.key]}
					/>
				{/each}
			{/each}
			{#if trend.series[0]}
				{#each trend.series[0].points as point, index (`label-${point.startAt.toISOString()}`)}
					<text
						x={chartX(index)}
						y="296"
						text-anchor="middle"
						class="fill-text-muted text-[11px]"
					>
						{point.label}
					</text>
				{/each}
			{/if}
		</svg>
		{#each trend.series as series (series.key)}
			{#each series.points as point, index (`hit-${series.key}-${point.startAt.toISOString()}`)}
				<button
					type="button"
					class="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
					style={`left: ${(chartX(index) / chartWidth) * 100}%; top: ${chartY(point.value)}px;`}
					onmouseenter={() => activateBucket(index, point.label, point.startAt)}
					onmouseleave={() => (activeBucket = null)}
					onfocus={() => activateBucket(index, point.label, point.startAt)}
					onblur={() => (activeBucket = null)}
					aria-label={bucketAccessibleLabel(point.label, point.startAt)}
					aria-describedby={activeTrend?.timestamp === point.startAt.getTime()
						? 'sales-trend-tooltip'
						: undefined}
				></button>
			{/each}
		{/each}
	</div>
</div>
