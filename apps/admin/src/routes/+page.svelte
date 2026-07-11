<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import { localizeAdminLabel } from '$lib/labels';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dashboard = $derived(data.dashboard);
	const chartWidth = 704;
	const chartHeight = 300;
	const chartStartX = 64;
	const chartStartY = 244;
	const chartStepX = 96;
	const chartHeightRange = 176;
	const maxTrendValue = $derived(
		Math.max(1, ...dashboard.activityTrend.map((point) => point.value))
	);

	function getChartCoordinates(index: number, value: number) {
		return {
			x: chartStartX + index * chartStepX,
			y: chartStartY - (value / maxTrendValue) * chartHeightRange
		};
	}

	function formatActivityValue(value: number) {
		return `${value} 筆`;
	}

	function formatDateTime(value: Date) {
		return new Intl.DateTimeFormat('zh-TW', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value);
	}

	const chartPoints = $derived(
		dashboard.activityTrend
			.map((point, index) => {
				const coordinates = getChartCoordinates(index, point.value);
				return `${coordinates.x},${coordinates.y}`;
			})
			.join(' ')
	);

	let activeTrendLabel = $state<string | null>(null);
	const activeTrendPoint = $derived.by(() => {
		if (!activeTrendLabel) {
			return null;
		}

		const index = dashboard.activityTrend.findIndex((point) => point.label === activeTrendLabel);

		if (index === -1) {
			return null;
		}

		const point = dashboard.activityTrend[index]!;
		const coordinates = getChartCoordinates(index, point.value);

		return {
			...point,
			...coordinates
		};
	});

	function levelTone(logLevel: string): 'accent' | 'neutral' | 'warning' | 'danger' {
		if (logLevel === 'error' || logLevel === 'fatal') return 'danger';
		if (logLevel === 'warn') return 'warning';
		if (logLevel === 'info') return 'accent';
		return 'neutral';
	}
</script>

<svelte:head>
	<title>儀表板 | 管理後台</title>
</svelte:head>

<div class="space-y-5">
	<section
		class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
		aria-label="營運指標"
	>
		{#each dashboard.metrics as metric (metric.label)}
			<article class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
				<span class="text-sm font-medium text-text-muted">{metric.label}</span>
				<strong class="mt-2 block text-2xl font-bold tracking-normal text-text-heading">
					{metric.value}
				</strong>
				{#if metric.trend}
					<div class="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
						<span class="font-semibold text-success">{metric.trend.change}</span>
						<span class="text-text-muted">{metric.trend.reference}</span>
					</div>
				{/if}
			</article>
		{/each}
	</section>

	<section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
		<article class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
			<div class="mb-3 flex items-center justify-between gap-3">
				<h2 class="text-lg font-semibold tracking-normal text-text-heading">7 日活動趨勢</h2>
			</div>
			<div class="overflow-x-auto pb-2">
				<div class="relative w-176 min-w-176 rounded-md border border-border bg-bg-sunken p-2">
					{#if activeTrendPoint}
						<div
							class="pointer-events-none absolute z-10 w-40 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-bg-surface px-3 py-2 shadow-sm"
							style={`left: clamp(5.5rem, ${activeTrendPoint.x}px, calc(100% - 5.5rem)); top: ${Math.max(activeTrendPoint.y - 12, 32)}px;`}
						>
							<div class="text-xs font-semibold uppercase tracking-caps text-text-muted">
								{activeTrendPoint.label}
							</div>
							<div class="mt-1 text-sm font-semibold text-text-heading">
								{formatActivityValue(activeTrendPoint.value)}
							</div>
						</div>
					{/if}

					<svg
						viewBox={`0 0 ${chartWidth} ${chartHeight}`}
						role="img"
						aria-label="7 日活動趨勢圖"
						class="h-72 w-176"
					>
						{#each [64, 108, 152, 196, 240] as y (y)}
							<line
								x1="48"
								x2="664"
								y1={y}
								y2={y}
								class="stroke-border"
							/>
						{/each}
						<polyline
							points={chartPoints}
							fill="none"
							stroke="var(--color-brand)"
							stroke-width="4"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						{#each dashboard.activityTrend as point, index (point.label)}
							{@const coordinates = getChartCoordinates(index, point.value)}
							<circle
								cx={coordinates.x}
								cy={coordinates.y}
								r="5"
								fill="var(--color-brand)"
							/>
							<text
								x={coordinates.x - 12}
								y="278"
								class="fill-text-muted text-xs"
							>
								{point.label}
							</text>
						{/each}
					</svg>

					{#each dashboard.activityTrend as point, index (point.label)}
						{@const coordinates = getChartCoordinates(index, point.value)}
						<button
							type="button"
							class="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
							style={`left: ${coordinates.x}px; top: ${coordinates.y}px;`}
							onmouseenter={() => (activeTrendLabel = point.label)}
							onmouseleave={() => (activeTrendLabel = null)}
							onfocus={() => (activeTrendLabel = point.label)}
							onblur={() => (activeTrendLabel = null)}
							aria-label={`${point.label} ${formatActivityValue(point.value)}`}
						></button>
					{/each}
				</div>
			</div>
		</article>

		<aside class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
			<h2 class="mb-4 text-lg font-semibold tracking-normal text-text-heading">最新日誌</h2>
			{#if dashboard.recentLogs.length === 0}
				<p class="text-sm text-text-muted">目前沒有可顯示的日誌。</p>
			{:else}
				<ul class="space-y-3">
					{#each dashboard.recentLogs as log (log.id)}
						<li class="rounded-md border border-border bg-bg-sunken p-3">
							<div class="flex flex-wrap items-center gap-2">
								<Badge tone={levelTone(log.level)}>{localizeAdminLabel(log.level)}</Badge>
								<Badge tone="neutral">{localizeAdminLabel(log.kind)}</Badge>
							</div>
							<p class="mt-2 text-sm font-medium text-text-heading">{log.message}</p>
							<p class="mt-1 text-xs text-text-muted">{formatDateTime(log.createdAt)}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</section>

	<section class="grid gap-5 xl:grid-cols-2">
		<article class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
			<h2 class="mb-4 text-lg font-semibold tracking-normal text-text-heading">商品分布</h2>
			<ul class="space-y-4">
				{#each dashboard.productMix as item (item.label)}
					<li>
						<div class="mb-2 flex items-center justify-between gap-3 text-sm">
							<span class="font-medium text-text-heading">{item.label}</span>
							<span class="font-semibold text-text-muted">{item.value}</span>
						</div>
						<div class="h-2 rounded-full bg-bg-sunken">
							<span
								class="block h-2 rounded-full bg-brand"
								style={`width: ${Math.max((item.value / Math.max(1, ...dashboard.productMix.map((entry) => entry.value))) * 100, 6)}%`}
							></span>
						</div>
					</li>
				{/each}
			</ul>
		</article>

		<article class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
			<h2 class="mb-4 text-lg font-semibold tracking-normal text-text-heading">營運訊號</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each dashboard.signals as signal (signal.label)}
					<article class="rounded-md border border-border bg-bg-sunken p-3">
						<span class="text-sm font-medium text-text-muted">{signal.label}</span>
						<strong class="mt-2 block text-xl text-text-heading">{signal.value}</strong>
						<p class="mt-1 text-xs text-text-muted">{signal.note}</p>
					</article>
				{/each}
			</div>
		</article>
	</section>
</div>
