import { describe, expect, it } from 'vitest';

import {
	getCatalogPreviewCategoryBySlug,
	getCatalogPreviewIndexData,
	getCatalogPreviewProductBySlug
} from '$lib/server/catalog-preview-data.js';

describe('catalog preview data', () => {
	it('returns a category tree and products for the catalog index', () => {
		const { categories, products } = getCatalogPreviewIndexData();

		expect(categories.length).toBeGreaterThan(1);
		expect(categories.some((category) => category.children.length > 0)).toBe(true);
		expect(products.length).toBeGreaterThan(3);
		expect(products.every((product) => product.skus.length > 0)).toBe(true);
	});

	it('resolves a product slug with sku attributes and preview images', () => {
		const product = getCatalogPreviewProductBySlug('precisiontip-universal-tips');

		expect(product).not.toBeNull();
		expect(product?.skus[0]?.attributes).toMatchObject({
			format: 'rack',
			sterility: 'sterile',
			volume: '200 uL'
		});
		expect(product?.skus[0]?.images[0]?.imageUrl.startsWith('data:image/svg+xml')).toBe(true);
	});

	it('resolves category records for product detail breadcrumbs', () => {
		const category = getCatalogPreviewCategoryBySlug('pipette-tips');

		expect(category).not.toBeNull();
		expect(category?.nameEn).toBe('Pipette Tips');
		expect(category?.productCount).toBe(2);
	});
});
