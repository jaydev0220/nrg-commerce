<script lang="ts">
	import { SlidersHorizontal } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	import type { CatalogSort } from '$lib/catalog/types.js';

	type Props = {
		resultCount: number;
		scopeLabel: string;
		sort: CatalogSort;
		onSortChange: (sort: CatalogSort) => void;
		onOpenFilters: () => void;
		drawerTriggerElement?: HTMLButtonElement | null;
	};

	let {
		resultCount,
		scopeLabel,
		sort,
		onSortChange,
		onOpenFilters,
		drawerTriggerElement = $bindable(null)
	}: Props = $props();
</script>

<div class="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
	<div>
		<p
			class="text-sm font-semibold text-text-heading"
			aria-live="polite"
		>
			{resultCount}
			{m.catalog_product_series()}
		</p>
		<p class="mt-1 text-xs text-text-muted">{scopeLabel}</p>
	</div>
	<div class="flex items-center gap-2">
		<button
			bind:this={drawerTriggerElement}
			type="button"
			class="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-bg-surface px-3 text-sm font-medium text-text-body shadow-xs transition-[color,background-color,border-color,transform] duration-base ease-ui hover:-translate-y-0.5 hover:border-border-accent hover:bg-bg-accent lg:hidden"
			onclick={onOpenFilters}
		>
			<SlidersHorizontal class="size-4" />
			<span>{m.catalog_filters()}</span>
		</button>
		<label class="flex items-center gap-2">
			<span class="hidden text-xs text-text-muted sm:inline">{m.catalog_sort_by()}</span>
			<select
				class="h-10 rounded-md border-border bg-bg-surface py-0 pl-3 pr-8 text-sm font-medium text-text-body shadow-xs transition-[color,background-color,border-color,transform] duration-base ease-ui hover:-translate-y-0.5 hover:border-border-accent hover:bg-bg-accent focus:border-border-accent focus:ring-2 focus:ring-brand"
				value={sort}
				onchange={(event) =>
					onSortChange((event.currentTarget as HTMLSelectElement).value as CatalogSort)}
			>
				<option value="featured">{m.catalog_sort_featured()}</option>
				<option value="price-asc">{m.catalog_sort_price_low()}</option>
				<option value="price-desc">{m.catalog_sort_price_high()}</option>
				<option value="name">{m.catalog_sort_name()}</option>
			</select>
		</label>
	</div>
</div>
