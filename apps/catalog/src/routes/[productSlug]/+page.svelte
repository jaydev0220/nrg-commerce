<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { page } from '$app/state';
	import { ArrowLeft } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	import type { PageProps } from './$types';
	import { createProductConfigurationModel } from '$lib/catalog/logic.js';
	import { localeFromPathname } from '$lib/catalog/query.js';
	import { localizeValue } from '$lib/catalog/ui.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import MarkdownContent from '$lib/components/MarkdownContent.svelte';
	import ProductBreadcrumb from '$lib/components/ProductBreadcrumb.svelte';
	import ProductConfigurator from '$lib/components/ProductConfigurator.svelte';
	import ProductImageGallery from '$lib/components/ProductImageGallery.svelte';

	let { data }: PageProps = $props();

	let locale = $derived(localeFromPathname(page.url.pathname));
	let requestedSelection = $state<Record<string, string>>({});
	let model = $derived(createProductConfigurationModel(data.product, locale, requestedSelection));
	let localizedName = $derived(localizeValue(locale, data.product.name, data.product.nameEn));
	let localizedDescription = $derived(
		localizeValue(locale, data.product.description, data.product.descriptionEn)
	);
	let localizedCategoryName = $derived(
		localizeValue(locale, data.category.name, data.category.nameEn)
	);
	let activeImages = $derived(
		model.activeSku.images.length > 0
			? model.activeSku.images
			: data.product.skus
					.flatMap((sku: (typeof data.product.skus)[number]) => sku.images)
					.slice(0, 1)
	);
	let selectedImageIndex = $state(0);
	let currentImageIndex = $derived(
		Math.min(selectedImageIndex, Math.max(activeImages.length - 1, 0))
	);
	let catalogHref = $derived(localizeHref('/', { locale }) as Pathname);

	function updateSelection(key: string, value: string) {
		requestedSelection = {
			...model.selectedAttributes,
			[key]: value
		};
		selectedImageIndex = 0;
	}
</script>

<main id="product-content">
	<ProductBreadcrumb
		{catalogHref}
		catalogLabel={m.catalog_title()}
		categoryLabel={localizedCategoryName}
		productLabel={localizedName}
	/>

	<section class="mx-auto max-w-360 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
		<a
			href={resolve(catalogHref)}
			class="mb-7 inline-flex items-center gap-2 rounded-md border border-border-strong bg-bg-surface px-3 py-2 text-sm font-semibold text-text-heading shadow-xs transition-[color,background-color,border-color,transform] duration-base ease-ui hover:-translate-y-0.5 hover:border-border-accent hover:bg-brand-subtle hover:text-text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
		>
			<ArrowLeft class="size-4" />
			<span>{m.catalog_back()}</span>
		</a>

		<div
			class="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,.9fr)] lg:items-start xl:gap-16"
		>
			<ProductImageGallery
				productName={localizedName}
				images={activeImages}
				selectedIndex={currentImageIndex}
				onSelectImage={(index) => (selectedImageIndex = index)}
				galleryLabel={m.catalog_gallery_title()}
			/>

			<ProductConfigurator
				{locale}
				categoryLabel={localizedCategoryName}
				productName={localizedName}
				productSkuCount={data.product.skus.length}
				{model}
				onSelectOption={updateSelection}
			/>
		</div>

		{#if localizedDescription}
			<section
				class="mt-12 border-t border-border pt-8 lg:mt-16 lg:pt-10"
				aria-labelledby="product-description-title"
			>
				<div class="max-w-4xl">
					<h2
						id="product-description-title"
						class="text-2xl tracking-normal"
					>
						{m.catalog_description_title()}
					</h2>
					<MarkdownContent source={localizedDescription} />
				</div>
			</section>
		{/if}
	</section>
</main>
