import { expect, test } from 'vitest';

import { buildCatalogQueryString, parseCatalogQueryState } from '$lib/catalog/query.js';

test('parseCatalogQueryState reads category and sort without attribute state', () => {
	const state = parseCatalogQueryState(
		new URLSearchParams('q=pipette&category=consumables&sort=name'),
		'en'
	);

	expect(state).toEqual({
		locale: 'en',
		query: 'pipette',
		categorySlug: 'consumables',
		sort: 'name'
	});
});

test('buildCatalogQueryString clears category when null is passed', () => {
	const queryString = buildCatalogQueryString({
		query: '',
		categorySlug: null,
		sort: 'featured'
	});

	expect(queryString).toBe('');
});
