import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createImageService } from '../../../src/modules/management/image.service.js';

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
		published: true,
		attributes: {},
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		images: []
	};
}

test('createImage stores the uploaded asset URL after verifying the object exists', async () => {
	let createdImageInput:
		| {
				imageUrl: string;
				assetKey?: string;
				altText: string;
				type: 'thumbnail' | 'gallery';
				position: number;
		  }
		| undefined;

	const imageService = createImageService({
		repository: {
			findSkuById: async () => createCatalogSkuRecord(),
			listImages: async () => ({ data: [], total: 0 }),
			findImageById: async () => null,
			createImage: async (_skuId, input) => {
				createdImageInput = input;

				return {
					id: 'image-1',
					skuId: 'sku-1',
					imageUrl: input.imageUrl,
					assetKey: input.assetKey ?? null,
					altText: input.altText,
					type: input.type,
					position: input.position,
					deletedAt: null,
					createdAt: new Date(),
					updatedAt: new Date()
				};
			},
			softDeleteImage: async () => undefined,
			forceDeleteImage: async () => undefined
		},
		objectStorage: {
			createImageUploadTarget: async () => {
				throw new Error('not used');
			},
			assertImageAssetExists: async () => ({
				assetKey: 'products/skus/sku-1/image.png',
				imageUrl: 'https://assets.example.com/products/skus/sku-1/image.png',
				contentType: 'image/png'
			})
		}
	});

	const image = await imageService.createImage('sku-1', {
		assetKey: 'products/skus/sku-1/image.png',
		altText: 'Front image',
		type: 'gallery',
		position: 1
	});

	assert.deepEqual(createdImageInput, {
		imageUrl: 'https://assets.example.com/products/skus/sku-1/image.png',
		assetKey: 'products/skus/sku-1/image.png',
		altText: 'Front image',
		type: 'gallery',
		position: 1
	});
	assert.equal(image.imageUrl, 'https://assets.example.com/products/skus/sku-1/image.png');
});

test('createImageUploadTarget rejects unknown skus before generating upload URLs', async () => {
	const imageService = createImageService({
		repository: {
			findSkuById: async () => null,
			listImages: async () => ({ data: [], total: 0 }),
			findImageById: async () => null,
			createImage: async () => {
				throw new Error('not used');
			},
			softDeleteImage: async () => undefined,
			forceDeleteImage: async () => undefined
		},
		objectStorage: {
			createImageUploadTarget: async () => {
				throw new Error('not used');
			},
			assertImageAssetExists: async () => {
				throw new Error('not used');
			}
		}
	});

	await assert.rejects(
		() =>
			imageService.createImageUploadTarget('missing-sku', {
				fileName: 'front.png',
				contentType: 'image/png'
			}),
		(error: unknown) => error instanceof AppError && error.code === 'SKU_NOT_FOUND'
	);
});
