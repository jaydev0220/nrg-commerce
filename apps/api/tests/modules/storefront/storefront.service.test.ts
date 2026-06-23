import assert from 'node:assert/strict';
import test from 'node:test';

import { createStorefrontCatalogService } from '../../../src/modules/storefront/storefront.service.js';

test('listSkus only returns published catalog items in storefront flows', async () => {
	const storefrontService = createStorefrontCatalogService({
		repository: {
			listCategories: async () => ({ data: [], total: 0 }),
			listProducts: async () => ({ data: [], total: 0 }),
			listSkus: async () => ({
				data: [
					{
						id: 'sku-1',
						productId: 'product-1',
						productSlug: 'published-product',
						skuCode: 'SKU-001',
						name: 'Published SKU',
						nameEn: 'Published SKU',
						description: 'Visible',
						descriptionEn: 'Visible',
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
						productId: 'product-2',
						productSlug: 'draft-product',
						skuCode: 'SKU-002',
						name: 'Draft SKU',
						nameEn: 'Draft SKU',
						description: 'Hidden',
						descriptionEn: 'Hidden',
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
			findProductById: async () => null,
			findProductBySlug: async () => null,
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

test('listProducts only returns published product profiles in storefront flows', async () => {
	const storefrontService = createStorefrontCatalogService({
		repository: {
			listCategories: async () => ({ data: [], total: 0 }),
			listProducts: async () => ({
				data: [
					{
						id: 'product-1',
						slug: 'published-product',
						name: 'Published Product',
						nameEn: 'Published Product',
						description: 'Visible',
						descriptionEn: 'Visible',
						categoryId: 'category-1',
						categorySlug: 'bags',
						published: true,
						deletedAt: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						skus: []
					},
					{
						id: 'product-2',
						slug: 'draft-product',
						name: 'Draft Product',
						nameEn: 'Draft Product',
						description: 'Hidden',
						descriptionEn: 'Hidden',
						categoryId: 'category-1',
						categorySlug: 'bags',
						published: false,
						deletedAt: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						skus: []
					}
				],
				total: 2
			}),
			listSkus: async () => ({ data: [], total: 0 }),
			findProductById: async () => null,
			findProductBySlug: async () => null,
			findSkuByCode: async () => null,
			findCategoryBySlug: async () => null,
			countProductsForCategoryIds: async () => ({}),
			countAssignedSkus: async () => 0,
			listChildCategories: async () => []
		}
	});

	const result = await storefrontService.listProducts({
		page: 1,
		limit: 20,
		includeSkus: false,
		includeImages: false,
		order: 'desc',
		sort: 'createdAt'
	});

	assert.equal(result.data.length, 1);
	assert.equal(result.data[0]?.id, 'product-1');
});

test('getProductBySlug only resolves published product profiles in storefront flows', async () => {
	const storefrontService = createStorefrontCatalogService({
		repository: {
			listCategories: async () => ({ data: [], total: 0 }),
			listProducts: async () => ({ data: [], total: 0 }),
			listSkus: async () => ({ data: [], total: 0 }),
			findProductById: async () => null,
			findProductBySlug: async (slug: string) =>
				slug === 'published-product'
					? {
							id: 'product-1',
							slug: 'published-product',
							name: 'Published Product',
							nameEn: 'Published Product',
							description: 'Visible',
							descriptionEn: 'Visible',
							categoryId: 'category-1',
							categorySlug: 'bags',
							published: true,
							deletedAt: null,
							createdAt: new Date(),
							updatedAt: new Date(),
							skus: []
						}
					: null,
			findSkuByCode: async () => null,
			findCategoryBySlug: async () => null,
			countProductsForCategoryIds: async () => ({}),
			countAssignedSkus: async () => 0,
			listChildCategories: async () => []
		}
	});

	const product = await storefrontService.getProductBySlug('published-product', {
		includeSkus: false,
		includeImages: false
	});

	assert.equal(product.slug, 'published-product');
});
