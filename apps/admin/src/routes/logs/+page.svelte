<script lang="ts">
	import { Eye, RotateCcw, Search } from '@lucide/svelte';

	import Badge from '$lib/components/Badge.svelte';
	import { localizeAdminLabel } from '$lib/labels';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let search = $state('');
	let level = $state('all');
	let kind = $state('all');

	const filteredLogs = $derived.by(() => {
		const query = search.trim().toLowerCase();

		return data.logs.filter((log) => {
			const matchesSearch = !query || log.message.toLowerCase().includes(query);
			const matchesLevel = level === 'all' || log.level === level;
			const matchesKind = kind === 'all' || log.kind === kind;

			return matchesSearch && matchesLevel && matchesKind;
		});
	});

	function resetFilters() {
		search = '';
		level = 'all';
		kind = 'all';
	}

	function levelTone(logLevel: string): 'accent' | 'neutral' | 'warning' | 'danger' {
		if (logLevel === 'error' || logLevel === 'fatal') return 'danger';
		if (logLevel === 'warn') return 'warning';
		if (logLevel === 'info') return 'accent';
		return 'neutral';
	}
</script>

<svelte:head>
	<title>日誌 | 管理後台</title>
</svelte:head>

<div class="space-y-5">
	<section
		class="rounded-lg border border-border bg-bg-surface shadow-xs"
		aria-labelledby="logs-list"
	>
		<div class="flex flex-col gap-3 border-b border-border p-4 2xl:flex-row 2xl:items-center">
			<h2
				id="logs-list"
				class="text-lg font-semibold tracking-normal text-text-heading"
			>
				日誌紀錄
			</h2>
			<div class="flex min-w-0 flex-1 flex-wrap gap-2">
				<label class="relative block min-w-[16rem] flex-1 basis-[18rem]">
					<Search
						class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
					/>
					<input
						bind:value={search}
						type="search"
						placeholder="搜尋事件"
						class="h-10 w-full rounded-md border border-border bg-bg-surface pl-9 pr-3 text-sm"
					/>
				</label>

				<label class="min-w-40 flex-1 basis-40 sm:flex-none sm:w-40">
					<select
						bind:value={level}
						class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
					>
						<option value="all">全部等級</option>
						{#each data.levelOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<label class="min-w-40 flex-1 basis-40 sm:flex-none sm:w-40">
					<select
						bind:value={kind}
						class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
					>
						<option value="all">全部種類</option>
						{#each data.kindOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<button
					type="button"
					class="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-bg-surface px-3 text-sm font-semibold text-text-body hover:bg-bg-sunken"
					onclick={resetFilters}
				>
					<RotateCcw class="size-4" />
					重設
				</button>
			</div>
		</div>

		<div class="hidden xl:block">
			<table class="w-full text-left text-sm">
				<thead
					class="border-b border-border bg-bg-sunken text-xs uppercase tracking-caps text-text-muted"
				>
					<tr>
						<th class="px-4 py-3">時間</th>
						<th class="px-4 py-3">等級</th>
						<th class="px-4 py-3">事件</th>
						<th class="px-4 py-3">種類</th>
						<th class="px-4 py-3 text-right">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each filteredLogs as log (log.id)}
						<tr>
							<td class="px-4 py-4 text-text-muted">{log.time}</td>
							<td class="px-4 py-4">
								<Badge tone={levelTone(log.level)}>{localizeAdminLabel(log.level)}</Badge>
							</td>
							<td class="px-4 py-4 font-medium text-text-heading">{log.message}</td>
							<td class="px-4 py-4 text-text-muted">{localizeAdminLabel(log.kind)}</td>
							<td class="px-4 py-4">
								<div class="flex justify-end">
									<button
										type="button"
										disabled
										class="inline-grid size-9 place-items-center rounded-md border border-border text-text-muted opacity-55"
										aria-label={`查看 ${log.message}`}
									>
										<Eye class="size-4" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="grid gap-3 p-4 xl:hidden">
			{#each filteredLogs as log (log.id)}
				<article class="rounded-lg border border-border bg-bg-surface p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="flex min-w-0 flex-wrap items-center gap-2">
							<Badge tone={levelTone(log.level)}>{localizeAdminLabel(log.level)}</Badge>
							<strong class="min-w-0 text-text-heading">{log.message}</strong>
						</div>
						<button
							type="button"
							disabled
							class="inline-grid size-9 shrink-0 place-items-center rounded-md border border-border text-text-muted opacity-55"
							aria-label={`查看 ${log.message}`}
						>
							<Eye class="size-4" />
						</button>
					</div>
					<div class="mt-3 text-sm text-text-muted">
						{log.time} · {localizeAdminLabel(log.kind)}
					</div>
				</article>
			{/each}
		</div>

		<div class="border-t border-border px-4 py-3 text-sm text-text-muted">
			顯示 {filteredLogs.length} / {data.logs.length} 筆日誌
		</div>
	</section>
</div>
