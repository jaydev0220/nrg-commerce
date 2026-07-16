import assert from 'node:assert/strict';
import test from 'node:test';

import type { DatabaseClient } from '@packages/database';

import { createPrismaStorefrontCatalogRepository } from '../../../src/modules/storefront/storefront.repository.js';

function createProduct(id: string, price: number) {
	const now = new Date();
	return {
		id,
		slug: id,
		name: id,
		nameEn: id,
		description: null,
		descriptionEn: null,
		categoryId: null,
		published: true,
		deletedAt: null,
		createdAt: now,
		updatedAt: now,
		category: null,
		skus: [
			{
				id: `${id}-sku`,
				productId: id,
				skuCode: `${id}-sku`,
				price: { toString: () => price.toFixed(2) },
				attributes: {},
				deletedAt: null,
				createdAt: now,
				updatedAt: now
			}
		]
	};
}

test('listProducts orders and paginates products by minimum active SKU price', async () => {
	const groupByCalls: Array<Record<string, unknown>> = [];
	const database = {
		productSku: {
			groupBy: async (input: Record<string, unknown>) => {
				groupByCalls.push(input);
				return input['_min']
					? [{ productId: 'product-2' }, { productId: 'product-1' }]
					: [{ productId: 'product-1' }, { productId: 'product-2' }];
			}
		},
		product: {
			findMany: async () => [createProduct('product-1', 20), createProduct('product-2', 10)],
			count: async () => 2
		}
	} as unknown as DatabaseClient;
	const repository = createPrismaStorefrontCatalogRepository(database);

	const result = await repository.listProducts(
		{
			page: 1,
			limit: 18,
			sort: 'minPrice',
			order: 'asc'
		},
		{
			includeSkus: true,
			includeImages: false,
			publishedOnly: true
		}
	);

	assert.deepEqual(
		result.data.map((product) => product.id),
		['product-2', 'product-1']
	);
	assert.equal(result.total, 2);
	assert.deepEqual(groupByCalls[0]?.['orderBy'], {
		_min: {
			price: 'asc'
		}
	});
});
