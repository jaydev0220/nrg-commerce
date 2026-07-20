import assert from 'node:assert/strict';
import test from 'node:test';

import {
	managementProductDetailQuerySchema,
	managementProductListQuerySchema,
	productCreateSchema,
	managementSkuDetailQuerySchema,
	productImageCreateSchema,
	productImageCropUpdateSchema,
	productImagePlacementSchema,
	productImageUploadRequestSchema,
	productCategoryUpdateSchema,
	productCategoryDeleteQuerySchema,
	productCategoryReorderSchema,
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
		stockQuantity: 8,
		attributes: {
			color: 'sand',
			sizes: ['m', 'l']
		}
	});

	assert.equal(parsedSku.productId, 'c1cf3cbb-c58b-4409-a449-85b086c9089a');
	assert.equal(parsedSku.stockQuantity, 8);
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

test('productCategoryReorderSchema requires unique sibling ids', () => {
	const parsed = productCategoryReorderSchema.parse({
		parentId: null,
		categoryIds: ['93f99825-2962-4a10-b453-daa375ff1c43']
	});
	assert.equal(parsed.parentId, null);
	assert.throws(() =>
		productCategoryReorderSchema.parse({
			parentId: null,
			categoryIds: ['93f99825-2962-4a10-b453-daa375ff1c43', '93f99825-2962-4a10-b453-daa375ff1c43']
		})
	);
});

test('productCategoryDeleteQuerySchema validates reassignment input', () => {
	assert.equal(
		productCategoryDeleteQuerySchema.parse({
			productDisposition: 'reassign',
			reassignToCategoryId: '93f99825-2962-4a10-b453-daa375ff1c43'
		}).childDisposition,
		'reject'
	);
	assert.throws(() => productCategoryDeleteQuerySchema.parse({ productDisposition: 'reassign' }));
	assert.throws(() =>
		productCategoryDeleteQuerySchema.parse({
			productDisposition: 'uncategorize',
			reassignToCategoryId: '93f99825-2962-4a10-b453-daa375ff1c43'
		})
	);
});

test('productImagePlacementSchema rejects removed image placements', () => {
	assert.throws(() => productImagePlacementSchema.parse('detail'));
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
	assert.equal(parsedImage.placement, 'shared-gallery');
	assert.equal(parsedImage.focusX, undefined);
	assert.equal(parsedImage.focusY, undefined);
	assert.equal(parsedImage.zoom, undefined);
});

test('productImageCreateSchema requires all crop fields together', () => {
	assert.throws(() =>
		productImageCreateSchema.parse({
			uploadId: '0189076c-4f2a-7fe1-b9fd-2d68df455401',
			altText: 'Front product image',
			placement: 'thumbnail',
			focusX: 0.25
		})
	);
	assert.throws(() =>
		productImageCreateSchema.parse({
			uploadId: '0189076c-4f2a-7fe1-b9fd-2d68df455401',
			altText: 'SKU image',
			placement: 'sku-gallery'
		})
	);
});

test('productSkuCreateSchema requires a non-negative stock quantity', () => {
	const base = {
		productId: 'c1cf3cbb-c58b-4409-a449-85b086c9089a',
		skuCode: 'SKU-001',
		price: 19.99,
		attributes: {}
	};
	assert.throws(() => productSkuCreateSchema.parse(base));
	assert.throws(() => productSkuCreateSchema.parse({ ...base, stockQuantity: -1 }));
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
		includeImages: 'true',
		sort: 'minPrice'
	});

	test('productImageCropUpdateSchema validates the persisted crop range', () => {
		assert.deepEqual(
			productImageCropUpdateSchema.parse({ focusX: 0.25, focusY: 0.75, zoom: 1.5 }),
			{ focusX: 0.25, focusY: 0.75, zoom: 1.5 }
		);
		assert.throws(() =>
			productImageCropUpdateSchema.parse({ focusX: 0.25, focusY: 0.75, zoom: 3.1 })
		);
	});
	const detailQuery = storefrontProductDetailQuerySchema.parse({
		includeSkus: 'true',
		includeImages: 'true'
	});

	assert.equal(listQuery.includeSkus, true);
	assert.equal(listQuery.includeImages, true);
	assert.equal(listQuery.sort, 'minPrice');
	assert.equal(detailQuery.includeSkus, true);
	assert.equal(detailQuery.includeImages, true);
});
