import { describe, expect, it } from 'vitest';

import { resolveProductVariantUrlState } from '$lib/catalog/product-urls.js';
import { createProductFixture } from '../../fixtures/product.js';

describe('product variant URLs', () => {
	it('keeps clean product URLs indexable', () => {
		expect(
			resolveProductVariantUrlState(
				new URL('https://catalog.example.test/en/laboratory-beaker'),
				createProductFixture()
			)
		).toEqual({
			canonicalPathname: '/en/laboratory-beaker',
			invalidSkuQuery: false,
			robots: 'index,follow',
			selectedSkuCode: null
		});
	});

	it('self-canonicalizes a single exact SKU query', () => {
		expect(
			resolveProductVariantUrlState(
				new URL('https://catalog.example.test/en/laboratory-beaker?sku=BEAKER-250'),
				createProductFixture()
			)
		).toEqual({
			canonicalPathname: '/en/laboratory-beaker?sku=BEAKER-250',
			invalidSkuQuery: false,
			robots: 'index,follow',
			selectedSkuCode: 'BEAKER-250'
		});
	});

	it('selects but noindexes valid SKU URLs with extra parameters', () => {
		const state = resolveProductVariantUrlState(
			new URL('https://catalog.example.test/laboratory-beaker?utm_source=test&sku=BEAKER-250'),
			createProductFixture()
		);

		expect(state.selectedSkuCode).toBe('BEAKER-250');
		expect(state.canonicalPathname).toBe('/laboratory-beaker?sku=BEAKER-250');
		expect(state.robots).toBe('noindex,follow');
	});

	it.each([
		'?sku=',
		'?sku=UNKNOWN',
		'?sku=BEAKER-250&sku=BEAKER-100',
		'?sku=beaker-250',
		'?sku=%20BEAKER-250%20'
	])('rejects invalid exact SKU query %s', (search) => {
		expect(
			resolveProductVariantUrlState(
				new URL(`https://catalog.example.test/laboratory-beaker${search}`),
				createProductFixture()
			).invalidSkuQuery
		).toBe(true);
	});
});
