<script lang="ts">
	import { Eye, RotateCcw, Search } from '@lucide/svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	import { AdminApiError, loadLogDetail } from '$lib/api/admin-api';
	import LogDetailDrawer from '$lib/components/logs/LogDetailDrawer.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import { applyFilters, scheduleFilters } from '$lib/filter-navigation';
	import { localizeAdminLabel } from '$lib/labels';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let detail = $state<Awaited<ReturnType<typeof loadLogDetail>> | null>(null);
	let formError = $state('');

	function levelTone(level: string): 'accent' | 'neutral' | 'warning' | 'danger' {
		return level === 'error' || level === 'fatal'
			? 'danger'
			: level === 'warn'
				? 'warning'
				: level === 'info'
					? 'accent'
					: 'neutral';
	}

	async function inspectLog(logId: string) {
		formError = '';
		try {
			detail = await loadLogDetail(logId);
		} catch (error) {
			formError = error instanceof AdminApiError ? error.message : '無法載入日誌內容。';
		}
	}
</script>

<svelte:head><title>日誌 | 管理後台</title></svelte:head>

<div class="space-y-5">
	<h1 class="text-xl font-semibold text-text-heading">日誌紀錄</h1>
	{#if formError}
		<p
			class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
			role="alert"
		>
			{formError}
		</p>
	{/if}
	<section class="rounded-lg border border-border bg-bg-surface shadow-xs">
		<form
			class="flex flex-wrap items-center gap-2 border-b border-border p-4"
			onsubmit={(event) => event.preventDefault()}
			oninput={(event) => scheduleFilters('/logs', event.currentTarget as HTMLFormElement)}
			onchange={(event) => applyFilters('/logs', event.currentTarget as HTMLFormElement)}
		>
			<label class="relative min-w-0 flex-[1_1_16rem]">
				<span class="sr-only">請求識別碼</span>
				<Search class="pointer-events-none absolute top-3 left-3 size-4 text-text-muted" />
				<input
					name="requestId"
					value={page.url.searchParams.get('requestId') ?? ''}
					placeholder="搜尋請求識別碼"
					class="h-10 w-full rounded-md border border-border bg-bg-surface pr-3 pl-9 text-sm"
				/>
			</label>
			<label class="min-w-32 flex-1">
				<span class="sr-only">日誌層級</span>
				<select
					name="level"
					class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
				>
					<option
						value=""
						selected={!page.url.searchParams.has('level')}
					>
						全部層級
					</option>
					{#each data.levelOptions as option (option.value)}
						<option
							value={option.value}
							selected={page.url.searchParams.get('level') === option.value}
						>
							{option.label}
						</option>
					{/each}
				</select>
			</label>
			<label class="min-w-32 flex-1">
				<span class="sr-only">日誌類型</span>
				<select
					name="kind"
					class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
				>
					<option
						value=""
						selected={!page.url.searchParams.has('kind')}
					>
						全部類型
					</option>
					{#each data.kindOptions as option (option.value)}
						<option
							value={option.value}
							selected={page.url.searchParams.get('kind') === option.value}
						>
							{option.label}
						</option>
					{/each}
				</select>
			</label>
			<a
				href={resolve('/logs')}
				class="inline-grid size-10 shrink-0 cursor-pointer place-items-center rounded-md border border-border"
				aria-label="重設篩選"
				title="重設篩選"
			>
				<RotateCcw class="size-4" />
			</a>
		</form>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[900px] text-left text-sm">
				<thead class="border-b border-border bg-bg-sunken text-xs text-text-muted">
					<tr>
						<th class="px-4 py-3">時間</th>
						<th class="px-4 py-3">層級</th>
						<th class="px-4 py-3">訊息</th>
						<th class="px-4 py-3">類型</th>
						<th class="px-4 py-3 text-right">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.logs as log (log.id)}
						<tr>
							<td class="px-4 py-4 whitespace-nowrap text-text-muted">{log.time}</td>
							<td class="px-4 py-4">
								<Badge tone={levelTone(log.level)}>{localizeAdminLabel(log.level)}</Badge>
							</td>
							<td class="max-w-md px-4 py-4 font-medium text-text-heading">
								<span class="block truncate">{log.message}</span>
							</td>
							<td class="px-4 py-4 text-text-muted">{localizeAdminLabel(log.kind)}</td>
							<td class="px-4 py-4 text-right">
								<button
									type="button"
									class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
									aria-label="檢視日誌詳細資料"
									title="檢視詳細資料"
									onclick={() => void inspectLog(log.id)}
								>
									<Eye class="size-4" />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pagination pagination={data.pagination} />
	</section>
</div>

{#if detail}
	<LogDetailDrawer
		{detail}
		onclose={() => (detail = null)}
	/>
{/if}
