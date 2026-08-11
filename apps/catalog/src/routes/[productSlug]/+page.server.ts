import type { PageServerLoad } from './$types';

import { redirect } from '@sveltejs/kit';

import { resolveProductVariantUrlState } from '$lib/catalog/product-urls.js';
import { fetchCatalogCategoryBySlug, fetchCatalogProductBySlug } from '$lib/server/catalog-api.js';

export const load: PageServerLoad = async ({ fetch, params, url }) => {
	const product = await fetchCatalogProductBySlug(fetch, params.productSlug);
	const variantUrlState = resolveProductVariantUrlState(url, product);
	if (variantUrlState.invalidSkuQuery) {
		redirect(302, url.pathname);
	}

	return {
		product,
		selectedSkuCode: variantUrlState.selectedSkuCode,
		category: product.categorySlug
			? await fetchCatalogCategoryBySlug(fetch, product.categorySlug)
			: null
	};
};
