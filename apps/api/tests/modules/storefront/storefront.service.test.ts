import assert from 'node:assert/strict';
import test from 'node:test';

import { createStorefrontCatalogService } from '../../../src/modules/storefront/storefront.service.js';

test('listSkus only returns published catalog items in storefront flows', async () => {
	const storefrontService = createStorefrontCatalogService({
		repository: {
			listCategories: async () => ({ data: [], total: 0 }),
			listSkus: async () => ({
				data: [
					{
						id: 'sku-1',
						skuCode: 'SKU-001',
						name: 'Published SKU',
						description: 'Visible',
						categoryId: 'category-1',
						categorySlug: 'bags',
						price: 19.99,
						published: true,
						attributes: {},
						deletedAt: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						images: []
					},
					{
						id: 'sku-2',
						skuCode: 'SKU-002',
						name: 'Draft SKU',
						description: 'Hidden',
						categoryId: 'category-1',
						categorySlug: 'bags',
						price: 29.99,
						published: false,
						attributes: {},
						deletedAt: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						images: []
					}
				],
				total: 2
			}),
			findSkuByCode: async () => null,
			findCategoryBySlug: async () => null,
			countProductsForCategoryIds: async () => ({}),
			countAssignedSkus: async () => 0,
			listChildCategories: async () => []
		}
	});

	const result = await storefrontService.listSkus({
		page: 1,
		limit: 20,
		includeImages: false,
		order: 'desc',
		sort: 'createdAt'
	});

	assert.equal(result.data.length, 1);
	assert.equal(result.data[0]?.skuCode, 'SKU-001');
});
