<script lang="ts">
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
	import { localeFromPathname } from '$lib/catalog/query.js';
	import { localizeValue } from '$lib/catalog/ui.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import CatalogHero from '$lib/components/CatalogHero.svelte';
	import CatalogPagination from '$lib/components/CatalogPagination.svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { deriveCatalogProductView } from '$lib/catalog/logic.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let locale = $derived(localeFromPathname(page.url.pathname));
	let categoryName = $derived(localizeValue(locale, data.category.name, data.category.nameEn));
	let categoryDescription = $derived(
		localizeValue(locale, data.category.description, data.category.descriptionEn) ??
			m.catalog_category_meta_description({ categoryName })
	);
	let productViews = $derived(
		data.products.map((product) => deriveCatalogProductView(product, locale))
	);

	function pageHref(pageNumber: number): string {
		const categoryHref = localizeHref(`/categories/${data.category.slug}`, { locale });
		return pageNumber > 1 ? `${categoryHref}?page=${pageNumber}` : categoryHref;
	}
</script>

<main id="catalog-content">
	<CatalogHero
		title={categoryName}
		description={categoryDescription}
		eyebrow={m.catalog_eyebrow({ year: new Date().getFullYear() })}
		homeLabel={m.catalog_title()}
		homeHref={localizeHref('/', { locale })}
	/>

	<section class="mx-auto max-w-360 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
		<div class="mb-6 flex flex-wrap items-baseline justify-between gap-3">
			<h2 class="text-xl tracking-normal">{m.catalog_all_products()}</h2>
			<span class="text-sm text-text-muted">
				{data.pagination.total}
				{m.catalog_product_series()}
			</span>
		</div>

		{#if productViews.length > 0}
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
				{#each productViews as view (view.id)}
					<ProductCard
						{view}
						categoryLabel={categoryName}
						href={localizeHref(`/${view.slug}`, { locale })}
					/>
				{/each}
			</div>
			<CatalogPagination
				page={data.pagination.page}
				totalPages={data.pagination.totalPages}
				getHref={pageHref}
			/>
		{/if}
	</section>
</main>
