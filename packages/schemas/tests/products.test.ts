import assert from 'node:assert/strict';
import test from 'node:test';

import {
	managementProductDetailQuerySchema,
	managementProductListQuerySchema,
	productCreateSchema,
	managementSkuDetailQuerySchema,
	productImageCreateSchema,
	productImageTypeSchema,
	productImageUploadRequestSchema,
	productCategoryUpdateSchema,
	productSkuCreateSchema,
	productUpdateSchema,
	storefrontProductDetailQuerySchema,
	storefrontProductListQuerySchema,
	storefrontSkuListQuerySchema
} from '../src/index.js';

test('productCreateSchema defaults published to false for the base product profile', () => {
	const parsedProduct = productCreateSchema.parse({
		name: 'Canvas Tote',
		categoryId: '93f99825-2962-4a10-b453-daa375ff1c43'
	});

	assert.equal(parsedProduct.published, false);
});

test('productSkuCreateSchema requires a productId and keeps attributes as an object', () => {
	const parsedSku = productSkuCreateSchema.parse({
		productId: 'c1cf3cbb-c58b-4409-a449-85b086c9089a',
		skuCode: 'SKU-001',
		price: '19.99',
		attributes: {
			color: 'sand',
			sizes: ['m', 'l']
		}
	});

	assert.equal(parsedSku.productId, 'c1cf3cbb-c58b-4409-a449-85b086c9089a');
	assert.deepEqual(parsedSku.attributes, {
		color: 'sand',
		sizes: ['m', 'l']
	});
});

test('productUpdateSchema requires at least one field', () => {
	assert.throws(() => productUpdateSchema.parse({}));
});

test('managementProductListQuerySchema parses include flags from query strings', () => {
	const parsedQuery = managementProductListQuerySchema.parse({
		includeSkus: 'true',
		includeImages: 'true'
	});

	assert.equal(parsedQuery.includeSkus, true);
	assert.equal(parsedQuery.includeImages, true);
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

test('managementProductDetailQuerySchema parses nested include flags from query strings', () => {
	const parsedQuery = managementProductDetailQuerySchema.parse({
		includeSkus: 'true',
		includeImages: 'true'
	});

	assert.equal(parsedQuery.includeSkus, true);
	assert.equal(parsedQuery.includeImages, true);
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

test('storefront product query schemas parse include flags from query strings', () => {
	const listQuery = storefrontProductListQuerySchema.parse({
		includeSkus: 'true',
		includeImages: 'true'
	});
	const detailQuery = storefrontProductDetailQuerySchema.parse({
		includeSkus: 'true',
		includeImages: 'true'
	});

	assert.equal(listQuery.includeSkus, true);
	assert.equal(listQuery.includeImages, true);
	assert.equal(detailQuery.includeSkus, true);
	assert.equal(detailQuery.includeImages, true);
});
