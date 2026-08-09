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
	type SeriesKey = (typeof seriesOrder)[number];

	let activeTimestamp = $state<number | null>(null);

	const totalPoints = $derived(trend.series.find((series) => series.key === 'total')?.points ?? []);
	const pointCount = $derived(totalPoints.length);
	const maxValue = $derived(
		Math.max(1, ...trend.series.flatMap((series) => series.points.map((point) => point.value)))
	);
	const activeTrend = $derived.by(() => {
		if (totalPoints.length === 0) return null;

		const selectedIndex =
			activeTimestamp === null
				? -1
				: totalPoints.findIndex((point) => point.startAt.getTime() === activeTimestamp);
		const index = selectedIndex >= 0 ? selectedIndex : totalPoints.length - 1;
		const point = totalPoints[index];
		if (!point) return null;

		const timestamp = point.startAt.getTime();
		const values = seriesOrder.map((key) => ({
			key,
			value: trend.series
				.find((series) => series.key === key)
				?.points.find((seriesPoint) => seriesPoint.startAt.getTime() === timestamp)?.value
		}));
		const coordinates: Array<{ value: number; keys: SeriesKey[] }> = [];
		for (const item of values) {
			if (item.value === undefined) continue;
			const coordinate = coordinates.find((candidate) => candidate.value === item.value);
			if (coordinate) coordinate.keys.push(item.key);
			else coordinates.push({ value: item.value, keys: [item.key] });
		}

		return {
			index,
			label: point.label,
			timestamp,
			x: chartX(index),
			values,
			coordinates
		};
	});

	function chartX(index: number): number {
		return plotLeft + (index / Math.max(pointCount - 1, 1)) * (plotRight - plotLeft);
	}

	function chartY(value: number): number {
		return plotBottom - (value / maxValue) * (plotBottom - plotTop);
	}

	function bucketRegion(index: number): { x: number; width: number } {
		if (pointCount <= 1) return { x: plotLeft, width: plotRight - plotLeft };

		const spacing = (plotRight - plotLeft) / (pointCount - 1);
		const x = chartX(index);
		const left = index === 0 ? plotLeft : x - spacing / 2;
		const right = index === pointCount - 1 ? plotRight : x + spacing / 2;
		return { x: left, width: right - left };
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

	function activateBucket(index: number): void {
		const point = totalPoints[index];
		if (point) activeTimestamp = point.startAt.getTime();
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

	function coordinateColor(keys: SeriesKey[]): string {
		return keys.length === 1 && keys[0] ? seriesColors[keys[0]] : 'var(--color-text-heading)';
	}

	function focusBucket(element: SVGRectElement, index: number): void {
		const target = element.ownerSVGElement?.querySelector<SVGRectElement>(
			`[data-bucket-index="${index}"]`
		);
		target?.focus({ preventScroll: true });
	}

	function handleBucketKeydown(event: KeyboardEvent, index: number): void {
		let nextIndex: number | null = null;
		if (event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1);
		if (event.key === 'ArrowRight') nextIndex = Math.min(pointCount - 1, index + 1);
		if (event.key === 'Home') nextIndex = 0;
		if (event.key === 'End') nextIndex = pointCount - 1;
		if (nextIndex === null) return;

		event.preventDefault();
		activateBucket(nextIndex);
		focusBucket(event.currentTarget as SVGRectElement, nextIndex);
	}

	function handleBucketPointer(event: PointerEvent, index: number): void {
		activateBucket(index);
		(event.currentTarget as SVGRectElement).focus({ preventScroll: true });
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

{#if activeTrend}
	<section
		id="sales-trend-details"
		class="mb-3 rounded-md border border-border bg-bg-sunken px-3 py-2"
		aria-label="所選銷售趨勢"
		aria-live="polite"
		aria-atomic="true"
	>
		<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<p class="text-sm font-semibold text-text-heading">{activeTrend.label}</p>
			<p class="text-xs text-text-muted">{formatDateTime(new Date(activeTrend.timestamp))}</p>
		</div>
		<dl class="mt-2 grid gap-2 sm:grid-cols-3">
			{#each activeTrend.values as item (item.key)}
				<div class="flex items-center justify-between gap-3 text-sm sm:block">
					<dt class="inline-flex items-center gap-2 text-text-muted">
						<span
							class="size-2.5 shrink-0 rounded-full"
							style={`background: ${seriesColors[item.key]}`}
						></span>
						{seriesLabels[item.key]}
					</dt>
					<dd class="font-semibold text-text-heading sm:mt-1">
						{item.value === undefined ? '—' : formatMoney(item.value)}
					</dd>
				</div>
			{/each}
		</dl>
	</section>
{/if}

<div class="overflow-x-auto">
	<div class="min-w-240">
		<svg
			viewBox={`0 0 ${chartWidth} ${chartHeight}`}
			class="block h-80 w-full"
			role="group"
			aria-label="銷售趨勢折線圖。使用方向鍵切換日期。"
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
						data-point-key={`${series.key}-${index}`}
						cx={chartX(index)}
						cy={chartY(point.value)}
						r="4"
						fill={seriesColors[series.key]}
					/>
				{/each}
			{/each}
			{#if activeTrend}
				<line
					x1={activeTrend.x}
					x2={activeTrend.x}
					y1={plotTop}
					y2={plotBottom}
					class="pointer-events-none stroke-text-muted/50"
					stroke-width="1"
					stroke-dasharray="4 4"
				/>
				{#each activeTrend.coordinates as coordinate (coordinate.value)}
					<circle
						data-active-coordinate
						data-series-count={coordinate.keys.length}
						cx={activeTrend.x}
						cy={chartY(coordinate.value)}
						r="7"
						fill="var(--color-bg-surface)"
						stroke={coordinateColor(coordinate.keys)}
						stroke-width="3"
						class="pointer-events-none"
					/>
				{/each}
			{/if}
			{#each totalPoints as point, index (`label-${point.startAt.toISOString()}`)}
				<text
					x={chartX(index)}
					y="296"
					text-anchor="middle"
					class="pointer-events-none fill-text-muted text-[11px]"
				>
					{point.label}
				</text>
			{/each}
			{#each totalPoints as point, index (`hit-${point.startAt.toISOString()}`)}
				{@const region = bucketRegion(index)}
				<rect
					data-bucket-index={index}
					x={region.x}
					y={plotTop}
					width={region.width}
					height={plotBottom - plotTop}
					tabindex={activeTrend?.index === index ? 0 : -1}
					role="button"
					aria-pressed={activeTrend?.index === index}
					aria-label={bucketAccessibleLabel(point.label, point.startAt)}
					aria-describedby="sales-trend-details"
					class="cursor-pointer fill-transparent focus-visible:fill-brand/5 focus-visible:stroke-brand focus-visible:stroke-2 focus-visible:outline-none"
					onpointerenter={() => activateBucket(index)}
					onpointerdown={(event) => handleBucketPointer(event, index)}
					onfocus={() => activateBucket(index)}
					onkeydown={(event) => handleBucketKeydown(event, index)}
				></rect>
			{/each}
		</svg>
	</div>
</div>
