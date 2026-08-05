import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { fetchCatalogCategoryBySlug, fetchCatalogIndexData } from '$lib/server/catalog-api.js';
import { localeFromPathname, parseCatalogQueryState } from '$lib/catalog/query.js';

const categoryPageSize = 18;

export const load: PageServerLoad = async ({ fetch, params, url }) => {
	const category = await fetchCatalogCategoryBySlug(fetch, params.slug, {
		includeProductCount: true
	});
	if ((category.productCount ?? 0) < 1) {
		throw error(404, 'The requested catalog category could not be found.');
	}

	const queryState = parseCatalogQueryState(url.searchParams, localeFromPathname(url.pathname));
	const data = await fetchCatalogIndexData(fetch, {
		page: queryState.page,
		limit: categoryPageSize,
		categorySlug: category.slug,
		sort: 'createdAt',
		order: 'desc'
	});

	if (queryState.page > Math.max(1, data.pagination.totalPages)) {
		throw error(404, 'The requested catalog page could not be found.');
	}

	return {
		...data,
		category,
		query: queryState
	};
};
