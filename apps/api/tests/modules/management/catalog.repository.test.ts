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

test('listSkus applies active management filters without pagination or image loading', async () => {
	let findManyInput: Record<string, unknown> | undefined;
	let countCalls = 0;
	const database = {
		productSku: {
			findMany: async (input: Record<string, unknown>) => {
				findManyInput = input;
				return [];
			},
			count: async () => {
				countCalls += 1;
				return 0;
			}
		}
	} as unknown as DatabaseClient;
	const repository = createPrismaCatalogRepository(database);

	const result = await repository.listSkus(
		{
			search: 'tea',
			published: false,
			categoryId: 'category-1',
			categorySlug: 'drinks',
			minPrice: 10,
			maxPrice: 100,
			sort: 'skuCode',
			order: 'asc'
		},
		{ paginate: false, includeImages: false, publishedOnly: true }
	);

	const where = findManyInput?.['where'] as Record<string, unknown>;
	const include = findManyInput?.['include'] as Record<string, unknown>;
	assert.equal(where['deletedAt'], null);
	assert.equal(Array.isArray(where['OR']), true);
	assert.deepEqual(where['price'], { lte: 100 });
	assert.equal('images' in include, false);
	assert.equal('skip' in (findManyInput ?? {}), false);
	assert.equal(countCalls, 0);
	assert.deepEqual(result, { data: [], total: 0 });
});

test('findSkuById supports active-only misses and archived records with all images', async () => {
	const inputs: Array<Record<string, unknown>> = [];
	const archivedSku = {
		id: 'sku-1',
		productId: 'product-1',
		skuCode: 'SKU-1',
		price: { toString: () => '100' },
		stockQuantity: 0,
		attributes: null,
		notes: null,
		deletedAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		images: [],
		product: {
			slug: 'product',
			name: 'Product',
			nameEn: null,
			description: null,
			descriptionEn: null,
			categoryId: null,
			published: false,
			category: null
		}
	};
	let call = 0;
	const database = {
		productSku: {
			findFirst: async (input: Record<string, unknown>) => {
				inputs.push(input);
				call += 1;
				return call === 1 ? null : archivedSku;
			}
		}
	} as unknown as DatabaseClient;
	const repository = createPrismaCatalogRepository(database);

	assert.equal(
		await repository.findSkuById('missing', {
			includeImages: false,
			publishedOnly: true
		}),
		null
	);
	const result = await repository.findSkuById('sku-1', {
		includeImages: true,
		includeDeleted: true
	});

	assert.equal(result?.availability, 'out_of_stock');
	assert.deepEqual(result?.attributes, {});
	assert.equal('images' in (inputs[0]?.['include'] as Record<string, unknown>), false);
	const archivedImages = (inputs[1]?.['include'] as Record<string, unknown>)['images'] as Record<
		string,
		unknown
	>;
	assert.equal('where' in archivedImages, false);
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

test('restoreSku skips image migration when the archived SKU has no image references', async () => {
	let productUpdates = 0;
	let imageUpdates = 0;
	const transaction = {
		productImage: {
			findMany: async () => [],
			updateMany: async () => {
				imageUpdates += 1;
			}
		},
		product: {
			updateMany: async () => {
				productUpdates += 1;
			}
		},
		productSku: {
			update: async () => ({
				id: 'sku-1',
				productId: 'product-2',
				skuCode: 'SKU-1',
				price: { toString: () => '120' },
				stockQuantity: 3,
				attributes: {},
				notes: null,
				deletedAt: null,
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

	await repository.restoreSku('sku-1', {
		productId: 'product-2',
		skuCode: 'SKU-1',
		price: 120,
		stockQuantity: 3,
		attributes: {}
	});

	assert.equal(productUpdates, 0);
	assert.equal(imageUpdates, 0);
});
