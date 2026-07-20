import assert from 'node:assert/strict';
import test from 'node:test';

import { createStorefrontCatalogService } from '../../../src/modules/storefront/storefront.service.js';

function createCategory(id: string, parentId: string | null = null) {
	const now = new Date();
	return {
		id,
		name: id,
		nameEn: id,
		slug: id,
		description: null,
		descriptionEn: null,
		position: 0,
		parentId,
		deletedAt: null,
		createdAt: now,
		updatedAt: now
	};
}

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
						stockQuantity: 5,
						availability: 'in_stock' as const,
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
						stockQuantity: 0,
						availability: 'out_of_stock' as const,
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
						thumbnail: null,
						images: [],
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
						thumbnail: null,
						images: [],
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
							thumbnail: null,
							images: [],
							skus: []
						}
					: null,
			findSkuByCode: async () => null,
			findCategoryBySlug: async () => null,
			countProductsForCategoryIds: async () => ({}),
			listChildCategories: async () => []
		}
	});

	const product = await storefrontService.getProductBySlug('published-product', {
		includeSkus: false,
		includeImages: false
	});

	assert.equal(product.slug, 'published-product');
});

test('listProducts expands a category filter to all descendant category ids', async () => {
	let receivedCategoryIds: string[] | undefined;
	const storefrontService = createStorefrontCatalogService({
		repository: {
			listCategories: async () => ({
				data: [
					createCategory('root'),
					createCategory('child', 'root'),
					createCategory('leaf', 'child')
				],
				total: 3
			}),
			listProducts: async (input) => {
				receivedCategoryIds = input.categoryIds;
				return { data: [], total: 0 };
			},
			listSkus: async () => ({ data: [], total: 0 }),
			findProductById: async () => null,
			findProductBySlug: async () => null,
			findSkuByCode: async () => null,
			findCategoryBySlug: async () => null,
			countProductsForCategoryIds: async () => ({}),
			listChildCategories: async () => []
		}
	});

	await storefrontService.listProducts({
		page: 1,
		limit: 18,
		categorySlug: 'root',
		includeSkus: true,
		includeImages: true,
		sort: 'minPrice',
		order: 'asc'
	});

	assert.deepEqual(receivedCategoryIds, ['root', 'child', 'leaf']);
});

test('listProducts rejects unknown category filters', async () => {
	const storefrontService = createStorefrontCatalogService({
		repository: {
			listCategories: async () => ({ data: [], total: 0 }),
			listProducts: async () => ({ data: [], total: 0 }),
			listSkus: async () => ({ data: [], total: 0 }),
			findProductById: async () => null,
			findProductBySlug: async () => null,
			findSkuByCode: async () => null,
			findCategoryBySlug: async () => null,
			countProductsForCategoryIds: async () => ({}),
			listChildCategories: async () => []
		}
	});

	await assert.rejects(
		storefrontService.listProducts({
			page: 1,
			limit: 18,
			categorySlug: 'missing',
			includeSkus: true,
			includeImages: true,
			sort: 'createdAt',
			order: 'desc'
		}),
		(error: { statusCode?: number }) => error.statusCode === 404
	);
});

test('listCategories aggregates visible product counts through category descendants', async () => {
	const storefrontService = createStorefrontCatalogService({
		repository: {
			listCategories: async () => ({
				data: [
					createCategory('root'),
					createCategory('child', 'root'),
					createCategory('leaf', 'child')
				],
				total: 3
			}),
			listProducts: async () => ({ data: [], total: 0 }),
			listSkus: async () => ({ data: [], total: 0 }),
			findProductById: async () => null,
			findProductBySlug: async () => null,
			findSkuByCode: async () => null,
			findCategoryBySlug: async () => null,
			countProductsForCategoryIds: async () => ({ root: 1, child: 2, leaf: 3 }),
			listChildCategories: async () => []
		}
	});

	const categories = await storefrontService.listCategories({
		includeTree: true,
		includeProductCount: true
	});
	const root = categories[0] as {
		productCount?: number;
		children: Array<{ productCount?: number }>;
	};

	assert.equal(root?.productCount, 6);
	assert.equal(root?.children[0]?.productCount, 5);
});

test('getProductBySlug hides published products without active SKUs when details include SKUs', async () => {
	const storefrontService = createStorefrontCatalogService({
		repository: {
			listCategories: async () => ({ data: [], total: 0 }),
			listProducts: async () => ({ data: [], total: 0 }),
			listSkus: async () => ({ data: [], total: 0 }),
			findProductById: async () => null,
			findProductBySlug: async () => ({
				id: 'product-1',
				slug: 'empty-product',
				name: 'Empty Product',
				nameEn: 'Empty Product',
				description: null,
				descriptionEn: null,
				categoryId: null,
				categorySlug: null,
				published: true,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				thumbnail: null,
				images: [],
				skus: []
			}),
			findSkuByCode: async () => null,
			findCategoryBySlug: async () => null,
			countProductsForCategoryIds: async () => ({}),
			listChildCategories: async () => []
		}
	});

	await assert.rejects(
		storefrontService.getProductBySlug('empty-product', {
			includeSkus: true,
			includeImages: true
		}),
		(error: { statusCode?: number }) => error.statusCode === 404
	);
});
