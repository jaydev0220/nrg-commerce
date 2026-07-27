import assert from 'node:assert/strict';
import test from 'node:test';

import { Prisma, type DatabaseClient } from '@packages/database';

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
	const productCountCalls: Array<Record<string, unknown>> = [];
	const database = {
		productSku: {
			groupBy: async (input: Record<string, unknown>) => {
				groupByCalls.push(input);
				return [{ productId: 'product-2' }, { productId: 'product-1' }];
			}
		},
		product: {
			findMany: async () => [createProduct('product-1', 20), createProduct('product-2', 10)],
			count: async (input: Record<string, unknown>) => {
				productCountCalls.push(input);
				return 2;
			}
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
	assert.deepEqual(groupByCalls[0]?.['orderBy'], [
		{
			_min: {
				price: 'asc'
			}
		},
		{ productId: 'asc' }
	]);
	assert.equal(groupByCalls.length, 1);
	assert.equal(productCountCalls.length, 1);
	assert.deepEqual(productCountCalls[0]?.['where'], {
		deletedAt: null,
		published: true,
		skus: { some: { deletedAt: null } }
	});
});

test('countProductsForCategoryIds uses one grouped query and preserves zero counts', async () => {
	const groupByCalls: Array<Record<string, unknown>> = [];
	const database = {
		product: {
			groupBy: async (input: Record<string, unknown>) => {
				groupByCalls.push(input);
				return [{ categoryId: 'category-2', _count: { _all: 3 } }];
			}
		}
	} as unknown as DatabaseClient;
	const repository = createPrismaStorefrontCatalogRepository(database);

	assert.deepEqual(await repository.countProductsForCategoryIds([], true), {});
	assert.deepEqual(
		await repository.countProductsForCategoryIds(['category-1', 'category-2'], true),
		{ 'category-1': 0, 'category-2': 3 }
	);
	assert.equal(groupByCalls.length, 1);
	assert.deepEqual(groupByCalls[0]?.['where'], {
		categoryId: { in: ['category-1', 'category-2'] },
		deletedAt: null,
		published: true,
		skus: { some: { deletedAt: null } }
	});
});

test('listSkus applies nested attribute filters before database pagination', async () => {
	const findManyCalls: Array<Record<string, unknown>> = [];
	const countCalls: Array<Record<string, unknown>> = [];
	const database = {
		productSku: {
			findMany: async (input: Record<string, unknown>) => {
				findManyCalls.push(input);
				return [];
			},
			count: async (input: Record<string, unknown>) => {
				countCalls.push(input);
				return 7;
			}
		}
	} as unknown as DatabaseClient;
	const repository = createPrismaStorefrontCatalogRepository(database);

	const result = await repository.listSkus(
		{
			page: 2,
			limit: 25,
			minPrice: 10,
			maxPrice: 20,
			attributes: {
				material: 'glass',
				dimensions: { height: 10 },
				labels: ['fragile', 'clear'],
				nullable: null
			},
			sort: 'createdAt',
			order: 'desc'
		},
		{
			includeImages: false,
			publishedOnly: true
		}
	);

	const expectedWhere = {
		deletedAt: null,
		product: { is: { deletedAt: null, published: true } },
		price: { gte: 10, lte: 20 },
		AND: [
			{ attributes: { path: ['material'], equals: 'glass' } },
			{ attributes: { path: ['dimensions', 'height'], equals: 10 } },
			{ attributes: { path: ['labels'], equals: ['fragile', 'clear'] } },
			{ attributes: { path: ['nullable'], equals: Prisma.JsonNull } }
		]
	};
	assert.deepEqual(result, { data: [], total: 7 });
	assert.equal(findManyCalls[0]?.['skip'], 25);
	assert.equal(findManyCalls[0]?.['take'], 25);
	assert.deepEqual(findManyCalls[0]?.['where'], expectedWhere);
	assert.deepEqual(countCalls[0]?.['where'], expectedWhere);
});
