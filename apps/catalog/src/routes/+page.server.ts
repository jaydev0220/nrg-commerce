import type { PageServerLoad } from './$types';

import { fetchCatalogIndexData } from '$lib/server/catalog-api.js';

export const load: PageServerLoad = async ({ fetch }) => {
	const { products, categories } = await fetchCatalogIndexData(fetch);

	return {
		products,
		categories
	};
};
