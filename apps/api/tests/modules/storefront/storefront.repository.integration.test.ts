import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { createDatabaseClient } from '@packages/database';
import { Pool } from 'pg';

import { createPrismaStorefrontCatalogRepository } from '../../../src/modules/storefront/storefront.repository.js';
import { databaseTestOptions, databaseUrl } from '../../test-database.js';

test(
	'storefront repository filters nested SKU attributes before pagination',
	databaseTestOptions,
	async () => {
		const pool = new Pool({ connectionString: databaseUrl, max: 2 });
		const database = createDatabaseClient({ pool });
		const repository = createPrismaStorefrontCatalogRepository(database);
		const suffix = randomUUID();
		const category = await database.productCategory.create({
			data: {
				name: 'Attribute filter integration category',
				slug: `attribute-filter-category-${suffix}`
			}
		});
		const product = await database.product.create({
			data: {
				name: 'Attribute filter integration product',
				slug: `attribute-filter-${suffix}`,
				categoryId: category.id,
				published: true
			}
		});

		try {
			await database.productSku.createMany({
				data: [
					{
						productId: product.id,
						skuCode: `ATTRIBUTE-MATCH-${suffix}`,
						price: 10,
						stockQuantity: 1,
						attributes: {
							material: 'glass',
							dimensions: { height: 10, width: 5 },
							labels: ['fragile', 'clear'],
							nullable: null
						}
					},
					{
						productId: product.id,
						skuCode: `ATTRIBUTE-HEIGHT-MISS-${suffix}`,
						price: 11,
						stockQuantity: 1,
						attributes: {
							material: 'glass',
							dimensions: { height: 11, width: 5 },
							labels: ['fragile', 'clear'],
							nullable: null
						}
					},
					{
						productId: product.id,
						skuCode: `ATTRIBUTE-ARRAY-MISS-${suffix}`,
						price: 12,
						stockQuantity: 1,
						attributes: {
							material: 'glass',
							dimensions: { height: 10, width: 5 },
							labels: ['clear', 'fragile'],
							nullable: null
						}
					}
				]
			});

			const result = await repository.listSkus(
				{
					page: 1,
					limit: 10,
					search: `ATTRIBUTE-`,
					attributes: {
						material: 'glass',
						dimensions: { height: 10 },
						labels: ['fragile', 'clear'],
						nullable: null
					},
					sort: 'skuCode',
					order: 'asc'
				},
				{ includeImages: false, publishedOnly: true }
			);

			assert.equal(result.total, 1);
			assert.equal(result.data[0]?.skuCode, `ATTRIBUTE-MATCH-${suffix}`);
			const emptyCategoryId = randomUUID();
			assert.deepEqual(
				await repository.countProductsForCategoryIds([category.id, emptyCategoryId], true),
				{ [category.id]: 1, [emptyCategoryId]: 0 }
			);
		} finally {
			await database.productSku.deleteMany({ where: { productId: product.id } });
			await database.product.delete({ where: { id: product.id } });
			await database.productCategory.delete({ where: { id: category.id } });
			await database.$disconnect();
			await pool.end();
		}
	}
);
