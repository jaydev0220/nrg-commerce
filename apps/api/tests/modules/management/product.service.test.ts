import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createProductService } from '../../../src/modules/management/product.service.js';

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
		skus: []
	};
}

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
			forceDeleteProduct: async () => undefined
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

test('deleteProduct rejects force deletion when variants are still assigned', async () => {
	const productService = createProductService({
		repository: {
			listProducts: async () => ({ data: [], total: 0 }),
			findProductById: async () => ({
				...createCatalogProductRecord(),
				skus: [
					{
						id: 'sku-1',
						productId: 'product-1',
						skuCode: 'SKU-001',
						name: 'Canvas Tote',
						nameEn: 'Canvas Tote',
						description: 'Everyday bag',
						descriptionEn: 'Everyday bag',
						categoryId: 'category-1',
						categorySlug: 'bags',
						productSlug: 'canvas-tote',
						published: true,
						price: 19.99,
						attributes: {},
						deletedAt: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						images: []
					}
				]
			}),
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
			forceDeleteProduct: async () => undefined
		}
	});

	await assert.rejects(
		() => productService.deleteProduct('product-1', { force: true }),
		(error: unknown) => error instanceof AppError && error.code === 'PRODUCT_DELETE_CONFLICT'
	);
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
			forceDeleteProduct: async () => undefined
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
