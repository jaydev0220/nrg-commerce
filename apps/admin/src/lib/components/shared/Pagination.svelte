<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';

	let { pagination }: { pagination: { page: number; totalPages: number; total: number } } =
		$props();

	function pageSearch(targetPage: number) {
		const url = new URL(page.url);
		url.searchParams.set('page', String(targetPage));
		return url.search;
	}
</script>

<nav
	class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm"
	aria-label="分頁"
>
	<span class="text-text-muted">共 {pagination.total} 筆</span>
	<div class="flex items-center gap-2">
		<button
			type="button"
			disabled={pagination.page <= 1}
			onclick={() =>
				goto(
					resolve(`${page.url.pathname}${pageSearch(Math.max(1, pagination.page - 1))}` as Pathname)
				)}
			class="inline-grid size-9 place-items-center rounded-md border border-border text-text-body disabled:pointer-events-none disabled:opacity-40"
			aria-label="上一頁"
		>
			<ChevronLeft class="size-4" />
		</button>
		<span class="min-w-20 text-center text-text-muted">
			{pagination.page} / {Math.max(1, pagination.totalPages)}
		</span>
		<button
			type="button"
			disabled={pagination.page >= pagination.totalPages || pagination.totalPages === 0}
			onclick={() =>
				goto(
					resolve(
						`${page.url.pathname}${pageSearch(
							Math.min(Math.max(1, pagination.totalPages), pagination.page + 1)
						)}` as Pathname
					)
				)}
			class="inline-grid size-9 place-items-center rounded-md border border-border text-text-body disabled:pointer-events-none disabled:opacity-40"
			aria-label="下一頁"
		>
			<ChevronRight class="size-4" />
		</button>
	</div>
</nav>
