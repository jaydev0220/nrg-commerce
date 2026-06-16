import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createProductService } from '../../../src/modules/management/product.service.js';

function createCatalogProductRecord() {
	return {
		id: 'product-1',
		name: 'Canvas Tote',
		description: 'Everyday bag',
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
			findCategoryById: async () => null,
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
						description: 'Everyday bag',
						categoryId: 'category-1',
						categorySlug: 'bags',
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
			findCategoryById: async () => null,
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
