import type { PageServerLoad } from './$types';

import { fetchCatalogCategoryBySlug, fetchCatalogProductBySlug } from '$lib/server/catalog-api.js';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const product = await fetchCatalogProductBySlug(fetch, params.productSlug);

	return {
		product,
		category: product.categorySlug
			? await fetchCatalogCategoryBySlug(fetch, product.categorySlug)
			: null
	};
};
