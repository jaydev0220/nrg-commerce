<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type {
		CatalogAttributeFacet,
		CatalogCategoryListEntry,
		CatalogLocale
	} from '$lib/catalog/types.js';

	type Props = {
		locale: CatalogLocale;
		categoryList: CatalogCategoryListEntry[];
		attributeFacets: CatalogAttributeFacet[];
		selectedCategorySlug: string | null;
		selectedAttributeFilters: Record<string, string[]>;
		onCategoryChange: (categorySlug: string | null) => void;
		onAttributeToggle: (key: string, value: string) => void;
		onReset: () => void;
	};

	let {
		locale,
		categoryList,
		attributeFacets,
		selectedCategorySlug,
		selectedAttributeFilters,
		onCategoryChange,
		onAttributeToggle,
		onReset
	}: Props = $props();

	function getCategoryName(entry: CatalogCategoryListEntry): string {
		return locale === 'en' ? (entry.category.nameEn ?? entry.category.name) : entry.category.name;
	}
</script>

<div class="space-y-8">
	<section>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-text-heading">{m.catalog_categories()}</h2>
			<button
				class="rounded px-1 py-0.5 text-xs font-medium text-text-accent transition-transform duration-base ease-ui hover:-translate-y-0.5 hover:underline"
				type="button"
				onclick={onReset}
			>
				{m.catalog_reset()}
			</button>
		</div>
		<div class="space-y-1">
			<button
				type="button"
				class={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-[color,background-color,transform] duration-base ease-ui hover:-translate-y-0.5 ${selectedCategorySlug === null ? 'bg-brand-subtle text-text-accent' : 'text-text-muted hover:bg-bg-sunken hover:text-text-heading'}`}
				onclick={() => onCategoryChange(null)}
			>
				<span class="min-w-0 flex-1 truncate">{m.catalog_all_categories()}</span>
			</button>
			{#each categoryList as entry (entry.category.id)}
				<button
					type="button"
					class={`flex w-full items-center gap-2 rounded-md py-2 text-left text-sm transition-[color,background-color,transform] duration-base ease-ui hover:-translate-y-0.5 ${entry.depth > 0 ? 'pl-7 pr-2' : 'px-2 font-semibold'} ${selectedCategorySlug === entry.category.slug ? 'bg-brand-subtle text-text-accent' : 'text-text-muted hover:bg-bg-sunken hover:text-text-heading'}`}
					onclick={() => onCategoryChange(entry.category.slug)}
				>
					{#if entry.depth > 0}
						<span class="h-px w-2.5 bg-border-strong"></span>
					{/if}
					<span class="min-w-0 flex-1 truncate">{getCategoryName(entry)}</span>
					{#if entry.category.productCount !== undefined}
						<span class="font-mono text-[10px]">{entry.category.productCount}</span>
					{/if}
				</button>
			{/each}
		</div>
	</section>

	<section class="border-t border-border pt-7">
		<h2 class="mb-4 text-sm font-semibold text-text-heading">{m.catalog_attributes()}</h2>
		<div class="space-y-5">
			{#each attributeFacets as facet (facet.key)}
				<div>
					<h3 class="mb-2 text-xs font-semibold uppercase tracking-caps text-text-muted">
						{facet.key}
					</h3>
					<div class="space-y-3">
						{#each facet.values as value (value)}
							<label
								class="flex cursor-pointer items-center gap-3 text-sm text-text-muted transition-[color,transform] duration-base ease-ui hover:-translate-y-0.5 hover:text-text-heading"
							>
								<input
									type="checkbox"
									checked={(selectedAttributeFilters[facet.key] ?? []).includes(value)}
									onchange={() => onAttributeToggle(facet.key, value)}
								/>
								<span>{value}</span>
							</label>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
