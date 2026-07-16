import { expect, test } from 'vitest';

import {
	buildCatalogQueryString,
	buildInquiryQueryString,
	parseCatalogQueryState,
	parseInquiryQueryState
} from '$lib/catalog/query.js';

test('parseCatalogQueryState reads category and sort without attribute state', () => {
	const state = parseCatalogQueryState(
		new URLSearchParams('q=pipette&category=consumables&sort=name'),
		'en'
	);

	expect(state).toEqual({
		locale: 'en',
		query: 'pipette',
		categorySlug: 'consumables',
		sort: 'name',
		page: 1
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

test('parseCatalogQueryState normalizes malformed pages to page one', () => {
	for (const rawPage of ['abc', '0', '-2']) {
		expect(parseCatalogQueryState(new URLSearchParams(`page=${rawPage}`), 'en').page).toBe(1);
	}
});

test('buildCatalogQueryString includes pages after the first page', () => {
	expect(
		buildCatalogQueryString({
			query: 'pipette',
			categorySlug: 'consumables',
			sort: 'featured',
			page: 3
		})
	).toBe('q=pipette&category=consumables&page=3');
});

test('parseInquiryQueryState reads and trims sku', () => {
	const state = parseInquiryQueryState(new URLSearchParams('sku=%20NRG-250%20'));

	expect(state).toEqual({
		skuCode: 'NRG-250'
	});
});

test('buildInquiryQueryString omits empty sku', () => {
	expect(buildInquiryQueryString({ skuCode: '  ' })).toBe('');
});

test('buildInquiryQueryString writes sku', () => {
	expect(buildInquiryQueryString({ skuCode: 'NRG-250' })).toBe('sku=NRG-250');
});
