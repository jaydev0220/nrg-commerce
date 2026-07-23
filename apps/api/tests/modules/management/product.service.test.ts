import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createProductService } from '../../../src/modules/management/product/product.service.js';

function createCatalogProductRecord() {
	return {
		id: 'product-1',
		slug: 'canvas-tote',
		name: 'Canvas Tote',
		nameEn: 'Canvas Tote',
		description: 'Everyday bag',
		descriptionEn: 'Everyday bag',
		categoryId: 'category-1',
		categorySlug: 'bags',
		published: true,
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		thumbnail: null,
		images: [],
		skus: []
	};
}

test('createProduct allows uncategorized products', async () => {
	let createdProductInput:
		| {
				slug: string;
				name: string;
				nameEn?: string;
				description?: string;
				descriptionEn?: string;
				categoryId?: string | null;
				published: boolean;
		  }
		| undefined;

	const productService = createProductService({
		repository: {
			listProducts: async () => ({ data: [], total: 0 }),
			findProductById: async () => null,
			findProductBySlug: async () => null,
			findCategoryById: async () => null,
			productSlugExists: async () => false,
			createProduct: async (input) => {
				createdProductInput = input;
				return {
					...createCatalogProductRecord(),
					categoryId: null,
					categorySlug: null,
					published: input.published
				};
			},
			updateProduct: async () => {
				throw new Error('not used');
			},
			softDeleteProduct: async () => undefined,
			restoreProduct: async () => createCatalogProductRecord(),
			bulkUpdateProducts: async () => ({
				updatedCount: 0,
				missingProductIds: [],
				invalidProductIds: []
			})
		}
	});

	const product = await productService.createProduct({
		name: 'Canvas Tote',
		slug: 'canvas-tote',
		published: false
	});

	assert.equal(createdProductInput?.categoryId, undefined);
	assert.equal(product.categoryId, null);
	assert.equal(product.categorySlug, null);
});

test('createProduct rejects unknown categories', async () => {
	const productService = createProductService({
		repository: {
			listProducts: async () => ({ data: [], total: 0 }),
			findProductById: async () => null,
			findProductBySlug: async () => null,
			findCategoryById: async () => null,
			productSlugExists: async () => false,
			createProduct: async () => {
				throw new Error('not used');
			},
			updateProduct: async () => {
				throw new Error('not used');
			},
			softDeleteProduct: async () => undefined,
			restoreProduct: async () => createCatalogProductRecord(),
			bulkUpdateProducts: async () => ({
				updatedCount: 0,
				missingProductIds: [],
				invalidProductIds: []
			})
		}
	});

	await assert.rejects(
		() =>
			productService.createProduct({
				name: 'Canvas Tote',
				slug: 'canvas-tote',
				categoryId: 'missing-category',
				published: false
			}),
		(error: unknown) => error instanceof AppError && error.code === 'CATEGORY_NOT_FOUND'
	);
});

test('updateProduct allows clearing the category assignment', async () => {
	let updatedProductInput:
		| {
				slug?: string;
				name?: string;
				nameEn?: string | null;
				description?: string | null;
				descriptionEn?: string | null;
				categoryId?: string | null;
				published?: boolean;
		  }
		| undefined;

	const productService = createProductService({
		repository: {
			listProducts: async () => ({ data: [], total: 0 }),
			findProductById: async () => createCatalogProductRecord(),
			findProductBySlug: async () => null,
			findCategoryById: async () => null,
			productSlugExists: async () => false,
			createProduct: async () => {
				throw new Error('not used');
			},
			updateProduct: async (_productId, input) => {
				updatedProductInput = input;
				return {
					...createCatalogProductRecord(),
					categoryId: null,
					categorySlug: null
				};
			},
			softDeleteProduct: async () => undefined,
			restoreProduct: async () => createCatalogProductRecord(),
			bulkUpdateProducts: async () => ({
				updatedCount: 0,
				missingProductIds: [],
				invalidProductIds: []
			})
		}
	});

	const product = await productService.updateProduct('product-1', {
		categoryId: null
	});

	assert.equal(updatedProductInput?.categoryId, null);
	assert.equal(product.categoryId, null);
	assert.equal(product.categorySlug, null);
});

test('deleteProduct always archives the top-level product record', async () => {
	let softDeletedProductId: string | undefined;
	const productService = createProductService({
		repository: {
			listProducts: async () => ({ data: [], total: 0 }),
			findProductById: async () => createCatalogProductRecord(),
			findProductBySlug: async () => null,
			findCategoryById: async () => null,
			productSlugExists: async () => false,
			createProduct: async () => {
				throw new Error('not used');
			},
			updateProduct: async () => {
				throw new Error('not used');
			},
			softDeleteProduct: async (productId) => {
				softDeletedProductId = productId;
			},
			restoreProduct: async () => createCatalogProductRecord(),
			bulkUpdateProducts: async () => ({
				updatedCount: 0,
				missingProductIds: [],
				invalidProductIds: []
			})
		}
	});

	assert.equal(await productService.deleteProduct('product-1'), 'soft');
	assert.equal(softDeletedProductId, 'product-1');
});

test('createProduct rejects duplicate product slugs', async () => {
	const productService = createProductService({
		repository: {
			listProducts: async () => ({ data: [], total: 0 }),
			findProductById: async () => null,
			findProductBySlug: async () => createCatalogProductRecord(),
			findCategoryById: async () => ({
				id: 'category-1',
				name: 'Bags',
				nameEn: 'Bags',
				slug: 'bags',
				description: null,
				descriptionEn: null,
				position: 0,
				parentId: null,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date()
			}),
			productSlugExists: async () => true,
			createProduct: async () => {
				throw new Error('not used');
			},
			updateProduct: async () => {
				throw new Error('not used');
			},
			softDeleteProduct: async () => undefined,
			restoreProduct: async () => createCatalogProductRecord(),
			bulkUpdateProducts: async () => ({
				updatedCount: 0,
				missingProductIds: [],
				invalidProductIds: []
			})
		}
	});

	await assert.rejects(
		() =>
			productService.createProduct({
				name: 'Canvas Tote',
				slug: 'canvas-tote',
				categoryId: 'category-1',
				published: false
			}),
		(error: unknown) => error instanceof AppError && error.code === 'PRODUCT_SLUG_CONFLICT'
	);
});

test('restoreProduct restores an archived product', async () => {
	let restored = false;
	const productService = createProductService({
		repository: {
			listProducts: async () => ({ data: [], total: 0 }),
			findProductById: async () => ({ ...createCatalogProductRecord(), deletedAt: new Date() }),
			findProductBySlug: async () => null,
			findCategoryById: async () => null,
			productSlugExists: async () => false,
			createProduct: async () => {
				throw new Error('not used');
			},
			updateProduct: async () => {
				throw new Error('not used');
			},
			softDeleteProduct: async () => undefined,
			restoreProduct: async () => {
				restored = true;
				return createCatalogProductRecord();
			},
			bulkUpdateProducts: async () => ({
				updatedCount: 0,
				missingProductIds: [],
				invalidProductIds: []
			})
		}
	});

	await productService.restoreProduct('product-1');
	assert.equal(restored, true);
});
