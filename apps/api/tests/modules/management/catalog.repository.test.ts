import assert from 'node:assert/strict';
import test from 'node:test';

import type { DatabaseClient } from '@packages/database';

import { createPrismaCatalogRepository } from '../../../src/modules/management/catalog.repository.js';

test('deleteCategory fails closed when a reassignment target is no longer active', async () => {
	const sourceCategoryId = '0189076c-4f2a-7fe1-b9fd-2d68df455111';
	const targetCategoryId = '0189076c-4f2a-7fe1-b9fd-2d68df455222';
	const checkedCategoryIds: string[] = [];
	const transaction = {
		$queryRaw: async () => ['locked'],
		productCategory: {
			findFirst: async (input: { where: { id: string } }) => {
				checkedCategoryIds.push(input.where.id);
				return input.where.id === sourceCategoryId ? { parentId: null, position: 0 } : null;
			},
			findMany: async () => {
				throw new Error('delete should stop before loading category relations');
			}
		},
		product: {
			count: async () => {
				throw new Error('delete should stop before counting assigned products');
			}
		}
	};
	const database = {
		$transaction: async (operation: (client: typeof transaction) => Promise<unknown>) =>
			operation(transaction)
	} as unknown as DatabaseClient;
	const repository = createPrismaCatalogRepository(database);

	const result = await repository.deleteCategory(sourceCategoryId, {
		productDisposition: 'reassign',
		childDisposition: 'none',
		reassignToCategoryId: targetCategoryId
	});

	assert.equal(result, 'reassign_not_found');
	assert.deepEqual(checkedCategoryIds, [sourceCategoryId, targetCategoryId]);
});

test('listSkus exposes archived SKUs across active and archived parent products', async () => {
	let findManyInput: Record<string, unknown> | undefined;
	const database = {
		productSku: {
			findMany: async (input: Record<string, unknown>) => {
				findManyInput = input;
				return [];
			},
			count: async () => 0
		}
	} as unknown as DatabaseClient;
	const repository = createPrismaCatalogRepository(database);

	await repository.listSkus(
		{ archived: true, sort: 'createdAt', order: 'desc', page: 1, limit: 20 },
		{ includeImages: true }
	);

	const where = findManyInput?.['where'] as {
		deletedAt: unknown;
		product: { is: Record<string, unknown> };
	};
	const include = findManyInput?.['include'] as { images: Record<string, unknown> };
	assert.deepEqual(where.deletedAt, { not: null });
	assert.equal('deletedAt' in where.product.is, false);
	assert.equal('where' in include.images, false);
});

test('restoreSku moves every bound image and clears stale thumbnail references atomically', async () => {
	let productUpdate: unknown;
	let imageUpdate: unknown;
	const transaction = {
		productImage: {
			findMany: async () => [{ id: 'image-1' }],
			updateMany: async (input: unknown) => {
				imageUpdate = input;
				return { count: 1 };
			}
		},
		product: {
			updateMany: async (input: unknown) => {
				productUpdate = input;
				return { count: 1 };
			}
		},
		productSku: {
			update: async (input: { data: Record<string, unknown> }) => ({
				id: 'sku-1',
				productId: input.data['productId'] as string,
				skuCode: input.data['skuCode'] as string,
				price: { toString: () => '120' },
				stockQuantity: 3,
				attributes: {},
				notes: null,
				deletedAt: input.data['deletedAt'] as Date | null,
				createdAt: new Date(),
				updatedAt: new Date(),
				images: [],
				product: {
					slug: 'destination',
					name: 'Destination',
					nameEn: null,
					description: null,
					descriptionEn: null,
					categoryId: null,
					published: false,
					category: null
				}
			})
		}
	};
	const database = {
		$transaction: async (operation: (client: typeof transaction) => Promise<unknown>) =>
			operation(transaction)
	} as unknown as DatabaseClient;
	const repository = createPrismaCatalogRepository(database);

	const restored = await repository.restoreSku('sku-1', {
		productId: 'product-2',
		skuCode: 'SKU-1',
		price: 120,
		stockQuantity: 3,
		attributes: {},
		notes: null
	});

	assert.deepEqual(productUpdate, {
		where: { thumbnailImageId: { in: ['image-1'] } },
		data: { thumbnailImageId: null }
	});
	assert.deepEqual(imageUpdate, {
		where: { skuId: 'sku-1' },
		data: { productId: 'product-2' }
	});
	assert.equal(restored.productId, 'product-2');
	assert.equal(restored.deletedAt, null);
});
