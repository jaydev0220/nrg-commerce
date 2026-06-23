<script lang="ts">
	import { X } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	type Props = {
		query: string;
		categorySlug: string | null;
		categoryLabel: string | null;
		attributeFilters: Record<string, string[]>;
		onQueryClear: () => void;
		onCategoryClear: () => void;
		onAttributeToggle: (key: string, value: string) => void;
	};

	let {
		query,
		categorySlug,
		categoryLabel,
		attributeFilters,
		onQueryClear,
		onCategoryClear,
		onAttributeToggle
	}: Props = $props();

	let hasFilters = $derived(
		Boolean(query || categorySlug || Object.keys(attributeFilters).length > 0)
	);
</script>

{#if hasFilters}
	<div class="mb-5 flex flex-wrap gap-2">
		{#if query}
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-sm border border-border-accent bg-brand-subtle px-2.5 py-1.5 text-xs font-medium text-text-accent"
				onclick={onQueryClear}
			>
				{m.catalog_results_for()}: “{query}”
				<X class="size-3" />
			</button>
		{/if}
		{#if categorySlug}
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-sm border border-border-accent bg-brand-subtle px-2.5 py-1.5 text-xs font-medium text-text-accent"
				onclick={onCategoryClear}
			>
				{m.catalog_active_category()}: {categoryLabel ?? categorySlug}
				<X class="size-3" />
			</button>
		{/if}
		{#each Object.entries(attributeFilters) as [key, values] (key)}
			{#each values as value (value)}
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded-sm border border-border-accent bg-brand-subtle px-2.5 py-1.5 text-xs font-medium text-text-accent"
					onclick={() => onAttributeToggle(key, value)}
				>
					{key}: {value}
					<X class="size-3" />
				</button>
			{/each}
		{/each}
	</div>
{/if}
