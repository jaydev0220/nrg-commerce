import assert from 'node:assert/strict';
import test from 'node:test';

import {
	productImageTypeSchema,
	productCategoryUpdateSchema,
	productSkuCreateSchema,
	storefrontSkuListQuerySchema
} from '../src/index.js';

test('productSkuCreateSchema defaults published to false and keeps attributes as an object', () => {
	const parsedSku = productSkuCreateSchema.parse({
		skuCode: 'SKU-001',
		name: 'Canvas Tote',
		categoryId: '93f99825-2962-4a10-b453-daa375ff1c43',
		price: '19.99',
		attributes: {
			color: 'sand',
			sizes: ['m', 'l']
		}
	});

	assert.equal(parsedSku.published, false);
	assert.deepEqual(parsedSku.attributes, {
		color: 'sand',
		sizes: ['m', 'l']
	});
});

test('storefrontSkuListQuerySchema parses attribute filters from JSON strings', () => {
	const parsedQuery = storefrontSkuListQuerySchema.parse({
		attributes: '{"material":"cotton","featured":true}',
		includeImages: 'true'
	});

	assert.deepEqual(parsedQuery.attributes, {
		material: 'cotton',
		featured: true
	});
	assert.equal(parsedQuery.includeImages, true);
});

test('productCategoryUpdateSchema requires at least one field', () => {
	assert.throws(() => productCategoryUpdateSchema.parse({}));
});

test('productImageTypeSchema rejects removed image types', () => {
	assert.throws(() => productImageTypeSchema.parse('detail'));
});
