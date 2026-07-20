<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { RotateCcw, Search } from '@lucide/svelte';

	import { applyFilters, scheduleFilters } from '$lib/filter-navigation';
</script>

<form
	class="flex flex-wrap items-center gap-2 border-b border-border p-4"
	onsubmit={(event) => event.preventDefault()}
	oninput={(event) => scheduleFilters('/products', event.currentTarget as HTMLFormElement)}
	onchange={(event) => applyFilters('/products', event.currentTarget as HTMLFormElement)}
>
	<label class="relative min-w-0 flex-[1_1_16rem]">
		<Search class="pointer-events-none absolute top-3 left-3 size-4 text-text-muted" />
		<input
			name="search"
			value={page.url.searchParams.get('search') ?? ''}
			aria-label="搜尋商品"
			class="h-10 w-full rounded-md border border-border bg-bg-surface pr-3 pl-9 text-sm"
		/>
	</label>
	<select
		name="published"
		aria-label="商品上架狀態"
		class="h-10 min-w-32 flex-1 rounded-md border border-border bg-bg-surface px-3 text-sm"
	>
		<option
			value=""
			selected={!page.url.searchParams.has('published')}
		>
			全部上架狀態
		</option>
		<option
			value="true"
			selected={page.url.searchParams.get('published') === 'true'}
		>
			已上架
		</option>
		<option
			value="false"
			selected={page.url.searchParams.get('published') === 'false'}
		>
			未上架
		</option>
	</select>
	<select
		name="archived"
		aria-label="商品封存狀態"
		class="h-10 min-w-32 flex-1 rounded-md border border-border bg-bg-surface px-3 text-sm"
	>
		<option
			value="false"
			selected={page.url.searchParams.get('archived') !== 'true'}
		>
			顯示使用中
		</option>
		<option
			value="true"
			selected={page.url.searchParams.get('archived') === 'true'}
		>
			顯示已封存
		</option>
	</select>
	<a
		href={resolve('/products')}
		class="inline-grid size-10 shrink-0 cursor-pointer place-items-center rounded-md border border-border"
		aria-label="重設篩選"
		title="重設篩選"
	>
		<RotateCcw class="size-4" />
	</a>
</form>
