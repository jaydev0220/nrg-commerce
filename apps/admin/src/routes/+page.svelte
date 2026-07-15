<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';

	import type { DashboardRange } from '$lib/api/admin-api';
	import SalesTrendChart from '$lib/components/dashboard/SalesTrendChart.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const dashboard = $derived(data.dashboard);
	const metricLabels = {
		completedSales: '完成訂單銷售額',
		completedOrders: '完成訂單數',
		businessSalesShare: '企業客戶銷售占比'
	} as const;
	function formatMoney(value: number): string {
		return new Intl.NumberFormat('zh-TW', {
			style: 'currency',
			currency: 'TWD',
			maximumFractionDigits: 0
		}).format(value);
	}

	function formatMetricValue(key: keyof typeof metricLabels, value: number): string {
		if (key === 'completedSales') return formatMoney(value);
		if (key === 'businessSalesShare') return `${value.toLocaleString('zh-TW')}%`;
		return value.toLocaleString('zh-TW');
	}

	function formatComparison(metric: PageData['dashboard']['metrics'][number]): string {
		const value = metric.comparison > 0 ? `+${metric.comparison}` : String(metric.comparison);
		return metric.comparisonKind === 'percentagePoint' ? `${value} 個百分點` : `${value}%`;
	}

	function rangeLabel(range: DashboardRange): string {
		return range === 'days' ? '日' : range === 'months' ? '月' : '季';
	}

	async function changeRange(range: DashboardRange) {
		if (range === dashboard.trend.range) return;
		await goto(resolve(`/?range=${range}` as Pathname), { invalidateAll: true });
	}
</script>

<svelte:head><title>儀表板 | 管理後台</title></svelte:head>

<div class="space-y-5">
	<section
		class="grid gap-3 md:grid-cols-3"
		aria-label="完成銷售指標"
	>
		{#each dashboard.metrics as metric (metric.key)}
			<article class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
				<span class="text-sm font-medium text-text-muted">{metricLabels[metric.key]}</span>
				<strong class="mt-2 block text-2xl font-bold tracking-normal text-text-heading">
					{formatMetricValue(metric.key, metric.value)}
				</strong>
				<div class="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
					<span
						class={metric.comparison < 0
							? 'font-semibold text-danger'
							: 'font-semibold text-success'}
					>
						{formatComparison(metric)}
					</span>
					<span class="text-text-muted">較上月</span>
				</div>
			</article>
		{/each}
	</section>

	<section class="rounded-lg border border-border bg-bg-surface p-3 shadow-xs sm:p-4">
		<div class="mb-2 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 class="text-lg font-semibold tracking-normal text-text-heading">完成銷售趨勢</h2>
				<p class="mt-1 text-xs text-text-muted">所有工作人員共用的完成訂單銷售資料</p>
			</div>
			<div
				class="flex shrink-0 rounded-md border border-border bg-bg-sunken p-1"
				role="group"
				aria-label="趨勢時間範圍"
			>
				{#each ['days', 'months', 'quarters'] as value (value)}
					{@const range = value as DashboardRange}
					<button
						type="button"
						class="min-w-12 rounded px-3 py-1.5 text-sm font-semibold transition aria-pressed:bg-brand aria-pressed:text-text-on-accent"
						aria-pressed={dashboard.trend.range === range}
						onclick={() => changeRange(range)}
					>
						{rangeLabel(range)}
					</button>
				{/each}
			</div>
		</div>
		<SalesTrendChart trend={dashboard.trend} />
	</section>

	<section class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<h2 class="text-lg font-semibold tracking-normal text-text-heading">熱門商品銷售額</h2>
			<span class="text-xs text-text-muted">本月完成訂單</span>
		</div>
		{#if dashboard.topProducts.length === 0}
			<p class="mt-4 text-sm text-text-muted">目前沒有完成訂單商品資料。</p>
		{:else}
			<div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
				{#each dashboard.topProducts as product (product.name)}
					<article class="rounded-md border border-border bg-bg-sunken p-3">
						<p class="truncate text-sm font-semibold text-text-heading">{product.name}</p>
						<p class="mt-2 text-lg font-bold text-text-heading">{formatMoney(product.value)}</p>
						<p class="mt-1 text-xs text-text-muted">占完成銷售 {product.share}%</p>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>
