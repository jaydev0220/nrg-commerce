import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createSkuService } from '../../../src/modules/management/sku/sku.service.js';

function skuRecord(overrides: Record<string, unknown> = {}) {
	return {
		id: 'sku-1',
		productId: 'product-1',
		productSlug: 'product',
		skuCode: 'SKU-1',
		name: 'Product',
		nameEn: null,
		description: null,
		descriptionEn: null,
		categoryId: null,
		categorySlug: null,
		price: 100,
		stockQuantity: 2,
		availability: 'in_stock' as const,
		published: false,
		attributes: {},
		notes: null,
		deletedAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		images: [],
		...overrides
	};
}

function productRecord() {
	return {
		id: 'product-2',
		slug: 'destination',
		name: 'Destination',
		nameEn: null,
		description: null,
		descriptionEn: null,
		notes: null,
		baseUnit: null,
		categoryId: null,
		categorySlug: null,
		published: false,
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		thumbnail: null,
		images: [],
		skus: []
	};
}

function repository(overrides: Record<string, unknown> = {}) {
	return {
		listSkus: async () => ({ data: [], total: 0 }),
		findSkuById: async () => skuRecord(),
		findProductById: async () => productRecord(),
		createSku: async () => skuRecord(),
		updateSku: async () => skuRecord(),
		restoreSku: async () => skuRecord({ deletedAt: null, productId: 'product-2' }),
		softDeleteSku: async () => undefined,
		forceDeleteSku: async () => undefined,
		skuCodeExists: async () => false,
		...overrides
	};
}

test('restoreSku reactivates an archived SKU under an active destination product', async () => {
	let restoredInput: unknown;
	const service = createSkuService({
		repository: repository({
			restoreSku: async (_skuId: string, input: unknown) => {
				restoredInput = input;
				return skuRecord({ deletedAt: null, productId: 'product-2' });
			}
		}) as never
	});
	const input = {
		productId: 'product-2',
		skuCode: 'SKU-1',
		price: 120,
		stockQuantity: 4,
		attributes: { size: 'large' },
		notes: null
	};

	const restored = await service.restoreSku('sku-1', input);

	assert.deepEqual(restoredInput, input);
	assert.equal(restored.sourceProductId, 'product-1');
	assert.equal(restored.sku.productId, 'product-2');
	assert.equal(restored.sku.deletedAt, null);
});

test('restoreSku rejects active SKUs and force deletion rejects every image reference', async () => {
	const activeService = createSkuService({
		repository: repository({ findSkuById: async () => skuRecord({ deletedAt: null }) }) as never
	});
	await assert.rejects(
		() =>
			activeService.restoreSku('sku-1', {
				productId: 'product-2',
				skuCode: 'SKU-1',
				price: 100,
				stockQuantity: 2,
				attributes: {}
			}),
		(error: unknown) => error instanceof AppError && error.code === 'SKU_NOT_DELETED'
	);

	const imageService = createSkuService({
		repository: repository({
			findSkuById: async () => skuRecord({ images: [{ id: 'image-1' }] })
		}) as never
	});
	await assert.rejects(
		() => imageService.deleteSku('sku-1', { force: true }),
		(error: unknown) => error instanceof AppError && error.code === 'SKU_DELETE_CONFLICT'
	);
});
