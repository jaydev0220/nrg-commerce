import assert from 'node:assert/strict';
import test from 'node:test';

import {
	managementSkuDetailQuerySchema,
	productImageCreateSchema,
	productImageTypeSchema,
	productImageUploadRequestSchema,
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

test('managementSkuDetailQuerySchema parses includeImages flags from query strings', () => {
	assert.equal(managementSkuDetailQuerySchema.parse({ includeImages: 'true' }).includeImages, true);
});

test('productImageCreateSchema stores uploaded asset references instead of raw image URLs', () => {
	const parsedImage = productImageCreateSchema.parse({
		assetKey: 'products/skus/93f99825-2962-4a10-b453-daa375ff1c43/0189076c-4f2a-7fe1-b9fd.png',
		altText: 'Front product image'
	});

	assert.equal(
		parsedImage.assetKey,
		'products/skus/93f99825-2962-4a10-b453-daa375ff1c43/0189076c-4f2a-7fe1-b9fd.png'
	);
	assert.equal(parsedImage.type, 'gallery');
	assert.equal(parsedImage.position, 0);
});

test('productImageUploadRequestSchema rejects non-image content types', () => {
	assert.throws(() =>
		productImageUploadRequestSchema.parse({
			fileName: 'manual.pdf',
			contentType: 'application/pdf'
		})
	);
});
