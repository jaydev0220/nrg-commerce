<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { X } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	import type { CatalogSort } from '$lib/catalog/types.js';
	import type { PageProps } from './$types';
	import { filterCatalogProducts, flattenCategoryNodes } from '$lib/catalog/logic.js';
	import {
		buildCatalogQueryString,
		localeFromPathname,
		parseCatalogQueryState
	} from '$lib/catalog/query.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import CatalogActiveFilters from '$lib/components/CatalogActiveFilters.svelte';
	import CatalogEmptyState from '$lib/components/CatalogEmptyState.svelte';
	import CatalogFilters from '$lib/components/CatalogFilters.svelte';
	import CatalogHelpCard from '$lib/components/CatalogHelpCard.svelte';
	import CatalogHero from '$lib/components/CatalogHero.svelte';
	import CatalogResultsToolbar from '$lib/components/CatalogResultsToolbar.svelte';
	import CatalogSearchBar from '$lib/components/CatalogSearchBar.svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';

	let { data }: PageProps = $props();

	let locale = $derived(localeFromPathname(page.url.pathname));
	let queryState = $derived(parseCatalogQueryState(page.url.searchParams, locale));
	let searchInput = $derived(queryState.query);
	let mobileFiltersOpen = $state(false);
	let drawerElement = $state.raw<HTMLElement | null>(null);
	let drawerTriggerElement = $state.raw<HTMLButtonElement | null>(null);
	let debounceTimer: number | null = null;

	let categoryList = $derived(flattenCategoryNodes(data.categories));
	let filteredViews = $derived(filterCatalogProducts(data.products, data.categories, queryState));
	let activeResultLabel = $derived.by(() => {
		if (queryState.query) {
			return `${m.catalog_results_for()} “${queryState.query}”`;
		}

		if (queryState.categorySlug) {
			return getCategoryLabel(queryState.categorySlug);
		}

		return m.catalog_all_products();
	});

	type QueryUpdate = {
		query?: string;
		categorySlug?: string | null;
		sort?: CatalogSort;
	};

	function getCategoryLabel(categorySlug: string): string {
		const entry = categoryList.find((item) => item.category.slug === categorySlug)?.category;
		if (!entry) {
			return categorySlug;
		}

		return locale === 'en' ? (entry.nameEn ?? entry.name) : entry.name;
	}

	function updateQuery(nextState: QueryUpdate) {
		const query = 'query' in nextState ? (nextState.query ?? '') : queryState.query;
		const categorySlug =
			'categorySlug' in nextState ? (nextState.categorySlug ?? null) : queryState.categorySlug;
		const sort = 'sort' in nextState ? (nextState.sort ?? 'featured') : queryState.sort;
		const queryString = buildCatalogQueryString({
			query,
			categorySlug,
			sort
		});
		const href = queryString
			? `${localizeHref('/', { locale })}?${queryString}`
			: localizeHref('/', { locale });

		goto(resolve(href as Pathname), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function resetFilters() {
		searchInput = '';
		updateQuery({
			query: '',
			categorySlug: null,
			sort: 'featured'
		});
	}

	function openMobileFilters() {
		mobileFiltersOpen = true;
		queueMicrotask(() => drawerElement?.focus());
	}

	function closeMobileFilters() {
		mobileFiltersOpen = false;
		drawerTriggerElement?.focus();
	}

	function handleDrawerKeydown(event: KeyboardEvent) {
		if (!mobileFiltersOpen || !drawerElement) {
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			closeMobileFilters();
			return;
		}

		if (event.key !== 'Tab') {
			return;
		}

		const focusable = [
			...drawerElement.querySelectorAll<HTMLElement>('button, input, select, a[href]')
		].filter((element) => !element.hasAttribute('disabled'));
		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (!first || !last) {
			return;
		}

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	$effect(() => {
		if (!browser) {
			return;
		}

		if (debounceTimer !== null) {
			window.clearTimeout(debounceTimer);
		}

		debounceTimer = window.setTimeout(() => {
			if (searchInput !== queryState.query) {
				updateQuery({ query: searchInput });
			}
		}, 200);

		return () => {
			if (debounceTimer !== null) {
				window.clearTimeout(debounceTimer);
				debounceTimer = null;
			}
		};
	});
</script>

<main>
	<CatalogHero
		title={m.catalog_title()}
		description={m.catalog_description()}
		eyebrow={m.catalog_eyebrow()}
		homeLabel={m.nav_home()}
	/>

	<section
		id="catalog-content"
		class="mx-auto max-w-360 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
	>
		<div class="mb-6 max-w-2xl">
			<CatalogSearchBar
				label={m.catalog_search_label()}
				placeholder={m.catalog_search_placeholder()}
				value={searchInput}
				oninput={(value) => (searchInput = value)}
			/>
		</div>

		<div class="grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)]">
			<aside
				class="hidden lg:block"
				aria-label={m.catalog_filters()}
			>
				<div class="sticky top-24 space-y-8">
					<CatalogFilters
						{locale}
						{categoryList}
						selectedCategorySlug={queryState.categorySlug}
						onCategoryChange={(categorySlug) => updateQuery({ categorySlug })}
						onReset={resetFilters}
					/>
					<CatalogHelpCard />
				</div>
			</aside>

			<div class="min-w-0">
				<CatalogResultsToolbar
					resultCount={filteredViews.length}
					scopeLabel={activeResultLabel}
					sort={queryState.sort}
					onSortChange={(sort) => updateQuery({ sort })}
					onOpenFilters={openMobileFilters}
					bind:drawerTriggerElement
				/>

				<CatalogActiveFilters
					query={queryState.query}
					categorySlug={queryState.categorySlug}
					categoryLabel={queryState.categorySlug ? getCategoryLabel(queryState.categorySlug) : null}
					onQueryClear={() => updateQuery({ query: '' })}
					onCategoryClear={() => updateQuery({ categorySlug: null })}
				/>

				{#if filteredViews.length > 0}
					<div
						class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
						aria-live="polite"
					>
						{#each filteredViews as view (view.id)}
							<ProductCard
								{view}
								categoryLabel={getCategoryLabel(view.categorySlug)}
								href={localizeHref(`/${view.slug}`, { locale })}
							/>
						{/each}
					</div>
				{:else}
					<CatalogEmptyState onReset={resetFilters} />
				{/if}
			</div>
		</div>
	</section>

	<button
		type="button"
		class={`fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-sm lg:hidden ${mobileFiltersOpen ? '' : 'hidden'}`}
		aria-label={m.catalog_filters()}
		onclick={closeMobileFilters}
	></button>
	<aside
		bind:this={drawerElement}
		class={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,360px)] flex-col bg-bg-surface shadow-lg transition-transform duration-slow ease-out lg:hidden ${mobileFiltersOpen ? 'translate-x-0' : '-translate-x-full'}`}
		aria-hidden={!mobileFiltersOpen}
		tabindex="-1"
		onkeydown={handleDrawerKeydown}
	>
		<div class="flex h-18 items-center justify-between border-b border-border px-5">
			<h2 class="text-lg">{m.catalog_filters()}</h2>
			<button
				type="button"
				class="grid size-9 place-items-center rounded-md border border-border bg-bg-sunken"
				onclick={closeMobileFilters}
			>
				<X class="size-5" />
			</button>
		</div>
		<div class="flex-1 overflow-y-auto px-5 py-6">
			<CatalogFilters
				{locale}
				{categoryList}
				selectedCategorySlug={queryState.categorySlug}
				onCategoryChange={(categorySlug) => updateQuery({ categorySlug })}
				onReset={resetFilters}
			/>
		</div>
		<div class="grid grid-cols-2 gap-3 border-t border-border p-5">
			<button
				type="button"
				class="rounded-md border border-border bg-bg-surface px-4 py-2.5 text-sm font-semibold"
				onclick={resetFilters}
			>
				{m.catalog_reset()}
			</button>
			<button
				type="button"
				class="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-text-on-accent"
				onclick={closeMobileFilters}
			>
				{m.catalog_show_results()}
			</button>
		</div>
	</aside>
</main>
