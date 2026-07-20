import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createImageService } from '../../../src/modules/management/image/image.service.js';

function createCatalogSkuRecord() {
	return {
		id: 'sku-1',
		productId: 'product-1',
		productSlug: 'catalog-sku',
		skuCode: 'SKU-001',
		name: 'Catalog SKU',
		nameEn: 'Catalog SKU',
		description: null,
		descriptionEn: null,
		categoryId: 'category-1',
		categorySlug: 'bags',
		price: 19.99,
		stockQuantity: 10,
		availability: 'in_stock' as const,
		published: true,
		attributes: {},
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		images: []
	};
}

function createCatalogProductRecord() {
	return {
		id: 'product-1',
		slug: 'catalog-product',
		name: 'Catalog Product',
		nameEn: 'Catalog Product',
		description: null,
		descriptionEn: null,
		categoryId: 'category-1',
		categorySlug: 'bags',
		published: true,
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		thumbnail: null,
		images: [],
		skus: []
	};
}

test('createImage stores the uploaded asset URL after verifying the object exists', async () => {
	let createdImageInput:
		| {
				imageUrl: string;
				assetKey?: string;
				altText: string;
				placement: 'thumbnail' | 'shared-gallery' | 'sku-gallery';
				skuId?: string | null;
				focusX?: number | null;
				focusY?: number | null;
				zoom?: number | null;
		  }
		| undefined;

	const imageService = createImageService({
		repository: {
			findProductById: async () => createCatalogProductRecord(),
			findSkuById: async () => createCatalogSkuRecord(),
			listImages: async () => ({ data: [], total: 0 }),
			findImageById: async () => ({
				id: 'image-1',
				productId: 'product-1',
				skuId: 'sku-1',
				imageUrl: 'https://assets.example.com/products/skus/sku-1/image.png',
				assetKey: 'products/skus/sku-1/image.png',
				altText: 'Thumbnail',
				placement: 'thumbnail',
				position: 0,
				focusX: 0.5,
				focusY: 0.5,
				zoom: 1,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date()
			}),
			createImageUpload: async (input) => ({
				id: 'upload-1',
				assetKey: input.assetKey,
				expiresAt: input.expiresAt
			}),
			findImageUpload: async () => ({
				id: 'upload-1',
				productId: 'product-1',
				assetKey: 'products/skus/sku-1/image.png',
				expiresAt: new Date(Date.now() + 60_000),
				consumedAt: null
			}),
			consumeImageUpload: async (_skuId, _uploadId, input) => {
				createdImageInput = input;

				return {
					id: 'image-1',
					productId: 'product-1',
					skuId: 'sku-1',
					imageUrl: input.imageUrl,
					assetKey: input.assetKey ?? null,
					altText: input.altText,
					placement: input.placement,
					position: 0,
					focusX: input.focusX ?? null,
					focusY: input.focusY ?? null,
					zoom: input.zoom ?? null,
					deletedAt: null,
					createdAt: new Date(),
					updatedAt: new Date()
				};
			},
			softDeleteImage: async () => undefined,
			forceDeleteImage: async () => undefined,
			restoreImage: async () => {
				throw new Error('not used');
			},
			listExpiredImages: async () => [],
			listExpiredImageUploads: async () => [],
			deleteImageUpload: async () => undefined,
			updateImageCrop: async (imageId, input) => ({
				id: imageId,
				productId: 'product-1',
				skuId: 'sku-1',
				imageUrl: 'https://assets.example.com/products/skus/sku-1/image.png',
				assetKey: 'products/skus/sku-1/image.png',
				altText: 'Thumbnail',
				placement: 'thumbnail',
				position: 0,
				focusX: input.focusX,
				focusY: input.focusY,
				zoom: input.zoom,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date()
			})
		},
		objectStorage: {
			createImageUploadTarget: async () => {
				throw new Error('not used');
			},
			assertImageAssetExists: async () => ({
				assetKey: 'products/skus/sku-1/image.png',
				imageUrl: 'https://assets.example.com/products/skus/sku-1/image.png',
				contentType: 'image/png'
			}),
			deleteImageAsset: async () => undefined
		}
	});

	const image = await imageService.createImage('product-1', {
		uploadId: 'upload-1',
		altText: 'Front image',
		placement: 'shared-gallery'
	});

	assert.deepEqual(createdImageInput, {
		skuId: undefined,
		imageUrl: 'https://assets.example.com/products/skus/sku-1/image.png',
		assetKey: 'products/skus/sku-1/image.png',
		altText: 'Front image',
		placement: 'shared-gallery',
		focusX: undefined,
		focusY: undefined,
		zoom: undefined
	});
	assert.equal(image.imageUrl, 'https://assets.example.com/products/skus/sku-1/image.png');
	const focusedImage = await imageService.updateImageCrop('product-1', 'image-1', {
		focusX: 0.2,
		focusY: 0.8,
		zoom: 1.5
	});
	assert.deepEqual(
		{ focusX: focusedImage.focusX, focusY: focusedImage.focusY },
		{ focusX: 0.2, focusY: 0.8 }
	);
	assert.equal(focusedImage.zoom, 1.5);
});

test('createImageUploadTarget rejects unknown skus before generating upload URLs', async () => {
	const imageService = createImageService({
		repository: {
			findProductById: async () => null,
			findSkuById: async () => null,
			listImages: async () => ({ data: [], total: 0 }),
			findImageById: async () => null,
			createImageUpload: async (input) => ({
				id: 'upload-1',
				assetKey: input.assetKey,
				expiresAt: input.expiresAt
			}),
			findImageUpload: async () => null,
			consumeImageUpload: async () => null,
			softDeleteImage: async () => undefined,
			forceDeleteImage: async () => undefined,
			restoreImage: async () => {
				throw new Error('not used');
			},
			listExpiredImages: async () => [],
			listExpiredImageUploads: async () => [],
			deleteImageUpload: async () => undefined,
			updateImageCrop: async () => {
				throw new Error('not used');
			}
		},
		objectStorage: {
			createImageUploadTarget: async () => {
				throw new Error('not used');
			},
			assertImageAssetExists: async () => {
				throw new Error('not used');
			},
			deleteImageAsset: async () => undefined
		}
	});

	await assert.rejects(
		() =>
			imageService.createImageUploadTarget('missing-product', {
				fileName: 'front.png',
				contentType: 'image/png',
				fileSize: 1024
			}),
		(error: unknown) => error instanceof AppError && error.code === 'PRODUCT_NOT_FOUND'
	);
});

test('deleteImage soft deletes normally and removes the asset on force delete', async () => {
	const deletedAt = new Date('2026-07-01T00:00:00.000Z');
	const imageRecord = {
		id: 'image-1',
		productId: 'product-1',
		skuId: 'sku-1',
		imageUrl: 'https://assets.example.com/products/skus/sku-1/image.png',
		assetKey: 'products/skus/sku-1/image.png',
		altText: 'Front image',
		placement: 'shared-gallery' as const,
		position: 0,
		focusX: null,
		focusY: null,
		zoom: null,
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date()
	};
	let softDeletedId: string | undefined;
	let forceDeletedId: string | undefined;
	let deletedAssetKey: string | undefined;
	const imageService = createImageService({
		repository: {
			findProductById: async () => createCatalogProductRecord(),
			findSkuById: async () => createCatalogSkuRecord(),
			listImages: async () => ({ data: [], total: 0 }),
			findImageById: async (_skuId, _imageId, includeDeleted = false) =>
				includeDeleted ? { ...imageRecord, deletedAt } : imageRecord,
			createImageUpload: async () => ({
				id: 'upload-1',
				assetKey: 'products/skus/sku-1/image.png',
				expiresAt: new Date()
			}),
			findImageUpload: async () => null,
			consumeImageUpload: async () => null,
			softDeleteImage: async (imageId) => {
				softDeletedId = imageId;
			},
			forceDeleteImage: async (imageId) => {
				forceDeletedId = imageId;
			},
			restoreImage: async () => imageRecord,
			listExpiredImages: async () => [],
			listExpiredImageUploads: async () => [],
			deleteImageUpload: async () => undefined,
			updateImageCrop: async () => {
				throw new Error('not used');
			}
		},
		objectStorage: {
			createImageUploadTarget: async () => {
				throw new Error('not used');
			},
			assertImageAssetExists: async () => {
				throw new Error('not used');
			},
			deleteImageAsset: async (assetKey) => {
				deletedAssetKey = assetKey;
			}
		}
	});

	assert.deepEqual(
		await imageService.deleteImage('product-1', 'image-1', { force: false, deleteAsset: false }),
		{ mode: 'soft', assetDeleted: false }
	);
	assert.equal(softDeletedId, 'image-1');

	assert.deepEqual(
		await imageService.deleteImage('product-1', 'image-1', { force: true, deleteAsset: false }),
		{ mode: 'force', assetDeleted: true }
	);
	assert.equal(forceDeletedId, 'image-1');
	assert.equal(deletedAssetKey, imageRecord.assetKey);
});

test('pruneExpiredAssets deletes expired objects and their database records', async () => {
	const deletedAssetKeys: string[] = [];
	const deletedImageIds: string[] = [];
	const deletedUploadIds: string[] = [];
	const imageService = createImageService({
		repository: {
			findProductById: async () => createCatalogProductRecord(),
			findSkuById: async () => createCatalogSkuRecord(),
			listImages: async () => ({ data: [], total: 0 }),
			findImageById: async () => null,
			createImageUpload: async () => ({
				id: 'upload-1',
				assetKey: 'products/skus/sku-1/image.png',
				expiresAt: new Date()
			}),
			findImageUpload: async () => null,
			consumeImageUpload: async () => null,
			softDeleteImage: async () => undefined,
			forceDeleteImage: async (imageId) => {
				deletedImageIds.push(imageId);
			},
			restoreImage: async () => {
				throw new Error('not used');
			},
			listExpiredImages: async () => [
				{ id: 'image-1', productId: 'product-1', assetKey: 'products/product-1/old.png' }
			],
			listExpiredImageUploads: async () => [
				{ id: 'upload-1', assetKey: 'products/skus/sku-1/pending.png' }
			],
			deleteImageUpload: async (uploadId) => {
				deletedUploadIds.push(uploadId);
			},
			updateImageCrop: async () => {
				throw new Error('not used');
			}
		},
		objectStorage: {
			createImageUploadTarget: async () => {
				throw new Error('not used');
			},
			assertImageAssetExists: async () => {
				throw new Error('not used');
			},
			deleteImageAsset: async (assetKey) => {
				deletedAssetKeys.push(assetKey);
			}
		}
	});

	const result = await imageService.pruneExpiredAssets(new Date('2026-07-31T00:00:00.000Z'));

	assert.deepEqual(result, { images: 1, uploads: 1 });
	assert.deepEqual(deletedImageIds, ['image-1']);
	assert.deepEqual(deletedUploadIds, ['upload-1']);
	assert.deepEqual(deletedAssetKeys, [
		'products/product-1/old.png',
		'products/skus/sku-1/pending.png'
	]);
});
