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
		slug: 'canvas-tote',
		categoryId: '93f99825-2962-4a10-b453-daa375ff1c43'
	});

	assert.equal(parsedProduct.published, false);
	assert.equal(parsedProduct.slug, 'canvas-tote');
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

test('productCreateSchema accepts optional English catalog content fields', () => {
	const parsedProduct = productCreateSchema.parse({
		name: '桌上型數位萬用電表 700 系列',
		nameEn: 'Bench Multimeter 700 Series',
		description: '主要中文描述',
		descriptionEn: 'Primary English description',
		slug: 'bench-multimeter-700',
		categoryId: '93f99825-2962-4a10-b453-daa375ff1c43'
	});

	assert.equal(parsedProduct.nameEn, 'Bench Multimeter 700 Series');
	assert.equal(parsedProduct.descriptionEn, 'Primary English description');
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

test('productImageCreateSchema accepts a pending upload reference', () => {
	const parsedImage = productImageCreateSchema.parse({
		uploadId: '0189076c-4f2a-7fe1-b9fd-2d68df455401',
		altText: 'Front product image'
	});

	assert.equal(parsedImage.uploadId, '0189076c-4f2a-7fe1-b9fd-2d68df455401');
	assert.equal(parsedImage.type, 'gallery');
	assert.equal(parsedImage.focusX, undefined);
	assert.equal(parsedImage.focusY, undefined);
});

test('productImageCreateSchema requires paired focus coordinates', () => {
	assert.throws(() =>
		productImageCreateSchema.parse({
			uploadId: '0189076c-4f2a-7fe1-b9fd-2d68df455401',
			altText: 'Front product image',
			type: 'thumbnail',
			focusX: 0.25
		})
	);
});

test('productImageUploadRequestSchema accepts supported image metadata', () => {
	assert.deepEqual(
		productImageUploadRequestSchema.parse({
			fileName: 'front.webp',
			contentType: 'image/webp',
			fileSize: 1024
		}),
		{ fileName: 'front.webp', contentType: 'image/webp', fileSize: 1024 }
	);
});

test('productImageUploadRequestSchema rejects unsupported types and oversized files', () => {
	assert.throws(() =>
		productImageUploadRequestSchema.parse({
			fileName: 'manual.pdf',
			contentType: 'application/pdf',
			fileSize: 1024
		})
	);
	assert.throws(() =>
		productImageUploadRequestSchema.parse({
			fileName: 'large.png',
			contentType: 'image/png',
			fileSize: 10 * 1024 * 1024 + 1
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
