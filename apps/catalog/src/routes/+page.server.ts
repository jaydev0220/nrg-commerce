import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

import { fetchCatalogIndexData } from '$lib/server/catalog-api.js';
import { localeFromPathname, parseCatalogQueryState } from '$lib/catalog/query.js';

const catalogPageSize = 18;

export const load: PageServerLoad = async ({ fetch, url }) => {
	const queryState = parseCatalogQueryState(url.searchParams, localeFromPathname(url.pathname));
	const apiSort =
		queryState.sort === 'name'
			? 'name'
			: queryState.sort === 'price-asc' || queryState.sort === 'price-desc'
				? 'minPrice'
				: 'createdAt';
	const apiOrder = queryState.sort === 'price-asc' || queryState.sort === 'name' ? 'asc' : 'desc';
	const data = await fetchCatalogIndexData(fetch, {
		page: queryState.page,
		limit: catalogPageSize,
		search: queryState.query || undefined,
		categorySlug: queryState.categorySlug ?? undefined,
		sort: apiSort,
		order: apiOrder
	});

	if (queryState.page > Math.max(1, data.pagination.totalPages)) {
		throw error(404, 'The requested catalog page could not be found.');
	}

	return {
		...data,
		query: queryState
	};
};
