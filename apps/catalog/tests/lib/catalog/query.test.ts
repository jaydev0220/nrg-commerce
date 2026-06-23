import { expect, test } from 'vitest';

import { buildCatalogQueryString, parseCatalogQueryState } from '$lib/catalog/query.js';

test('parseCatalogQueryState reads category and attribute filters without price state', () => {
	const state = parseCatalogQueryState(
		new URLSearchParams('q=pipette&category=consumables&sort=name&attribute.Volume=10uL,20uL'),
		'en'
	);

	expect(state).toEqual({
		locale: 'en',
		query: 'pipette',
		categorySlug: 'consumables',
		attributeFilters: {
			Volume: ['10uL', '20uL']
		},
		sort: 'name'
	});
});

test('buildCatalogQueryString clears category when null is passed', () => {
	const queryString = buildCatalogQueryString({
		query: '',
		categorySlug: null,
		sort: 'featured',
		attributeFilters: {}
	});

	expect(queryString).toBe('');
});
