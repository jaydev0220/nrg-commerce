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
	const tooltipWidth = 224;
	const tooltipHeight = 126;
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
	let graphElement = $state<HTMLDivElement>();
	let touchSelection = false;

	const totalPoints = $derived(trend.series.find((series) => series.key === 'total')?.points ?? []);
	const pointCount = $derived(totalPoints.length);
	const maxValue = $derived(
		Math.max(1, ...trend.series.flatMap((series) => series.points.map((point) => point.value)))
	);
	const activeTrend = $derived.by(() => {
		if (totalPoints.length === 0 || activeTimestamp === null) return null;

		const index = totalPoints.findIndex((point) => point.startAt.getTime() === activeTimestamp);
		if (index < 0) return null;
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

	function tooltipX(x: number): number {
		return Math.min(plotRight - tooltipWidth, Math.max(plotLeft, x - tooltipWidth / 2));
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

	function clearActiveTrend(): void {
		activeTimestamp = null;
	}

	function bucketTabIndex(index: number): number {
		if (activeTrend) return activeTrend.index === index ? 0 : -1;
		return index === pointCount - 1 ? 0 : -1;
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
		touchSelection = event.pointerType === 'touch';
		(event.currentTarget as SVGRectElement).focus({ preventScroll: true });
	}

	function handlePointerEnter(index: number): void {
		touchSelection = false;
		activateBucket(index);
	}

	function handleGraphPointerLeave(): void {
		if (!touchSelection) clearActiveTrend();
	}

	function handleGraphFocusOut(event: FocusEvent): void {
		const nextTarget = event.relatedTarget;
		if (!(nextTarget instanceof Node) || !graphElement?.contains(nextTarget)) clearActiveTrend();
	}

	function handleDocumentPointerDown(event: PointerEvent): void {
		if (!touchSelection) return;
		const target = event.target;
		if (target instanceof Node && graphElement?.contains(target)) return;
		touchSelection = false;
		clearActiveTrend();
	}
</script>

<svelte:document onpointerdown={handleDocumentPointerDown} />

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
	<div
		class="relative min-w-240"
		bind:this={graphElement}
		role="group"
		aria-label="銷售趨勢互動區"
		onpointerleave={handleGraphPointerLeave}
		onfocusout={handleGraphFocusOut}
	>
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
					tabindex={bucketTabIndex(index)}
					role="button"
					aria-pressed={activeTrend?.index === index}
					aria-label={bucketAccessibleLabel(point.label, point.startAt)}
					aria-describedby={activeTrend?.index === index ? 'sales-trend-details' : undefined}
					class="cursor-pointer fill-transparent focus-visible:fill-brand/5 focus-visible:stroke-brand focus-visible:stroke-2 focus-visible:outline-none"
					onpointerenter={() => handlePointerEnter(index)}
					onpointerdown={(event) => handleBucketPointer(event, index)}
					onfocus={() => activateBucket(index)}
					onkeydown={(event) => handleBucketKeydown(event, index)}
				></rect>
			{/each}
			{#if activeTrend}
				<foreignObject
					data-trend-card
					x={tooltipX(activeTrend.x)}
					y={plotTop}
					width={tooltipWidth}
					height={tooltipHeight}
					class="pointer-events-none overflow-visible"
				>
					<section
						id="sales-trend-details"
						class="rounded-md border border-border bg-bg-surface/95 px-3 py-2 shadow-md backdrop-blur-sm"
						aria-label="所選銷售趨勢"
						aria-live="polite"
						aria-atomic="true"
					>
						<div class="flex items-baseline justify-between gap-3">
							<p class="text-sm font-semibold text-text-heading">{activeTrend.label}</p>
							<p class="truncate text-[11px] text-text-muted">
								{formatDateTime(new Date(activeTrend.timestamp))}
							</p>
						</div>
						<dl class="mt-1.5 space-y-1">
							{#each activeTrend.values as item (item.key)}
								<div class="flex items-center justify-between gap-3 text-xs">
									<dt class="inline-flex min-w-0 items-center gap-2 text-text-muted">
										<span
											class="size-2 shrink-0 rounded-full"
											style={`background: ${seriesColors[item.key]}`}
										></span>
										<span class="truncate">{seriesLabels[item.key]}</span>
									</dt>
									<dd class="shrink-0 font-semibold text-text-heading">
										{item.value === undefined ? '—' : formatMoney(item.value)}
									</dd>
								</div>
							{/each}
						</dl>
					</section>
				</foreignObject>
			{/if}
		</svg>
	</div>
</div>
