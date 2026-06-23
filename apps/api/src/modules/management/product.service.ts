import { AppError } from '../../errors/app-error.js';
import type { CatalogProductRecord } from '../../types/catalog.js';

import type { CatalogRepository } from './catalog.repository.js';

type ProductListQuery = {
	page: number;
	limit: number;
	search?: string;
	published?: boolean;
	categoryId?: string;
	sort: 'name' | 'createdAt' | 'updatedAt';
	order: 'asc' | 'desc';
	includeSkus: boolean;
	includeImages: boolean;
};

type ProductDetailQuery = {
	includeSkus: boolean;
	includeImages: boolean;
};

type ProductServiceDependencies = {
	repository: Pick<
		CatalogRepository,
		| 'listProducts'
		| 'findProductById'
		| 'findProductBySlug'
		| 'findCategoryById'
		| 'productSlugExists'
		| 'createProduct'
		| 'updateProduct'
		| 'softDeleteProduct'
		| 'forceDeleteProduct'
	>;
};

function ensureProduct(product: CatalogProductRecord | null): CatalogProductRecord {
	if (!product) {
		throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The requested product could not be found.');
	}

	return product;
}

export function createProductService(dependencies: ProductServiceDependencies) {
	return {
		listProducts(query: ProductListQuery) {
			return dependencies.repository.listProducts(query, {
				includeSkus: query.includeSkus,
				includeImages: query.includeImages
			});
		},

		async getProduct(productId: string, query: ProductDetailQuery): Promise<CatalogProductRecord> {
			return ensureProduct(
				await dependencies.repository.findProductById(productId, {
					includeSkus: query.includeSkus,
					includeImages: query.includeImages
				})
			);
		},

		async createProduct(input: {
			slug: string;
			name: string;
			nameEn?: string;
			description?: string;
			descriptionEn?: string;
			categoryId: string;
			published: boolean;
		}): Promise<CatalogProductRecord> {
			if (!(await dependencies.repository.findCategoryById(input.categoryId))) {
				throw new AppError(
					404,
					'CATEGORY_NOT_FOUND',
					'The referenced product category could not be found.'
				);
			}

			if (await dependencies.repository.productSlugExists(input.slug)) {
				throw new AppError(
					409,
					'PRODUCT_SLUG_CONFLICT',
					'The requested product slug is already in use.'
				);
			}

			return dependencies.repository.createProduct(input);
		},

		async updateProduct(
			productId: string,
			input: {
				slug?: string;
				name?: string;
				nameEn?: string | null;
				description?: string | null;
				descriptionEn?: string | null;
				categoryId?: string;
				published?: boolean;
			}
		): Promise<CatalogProductRecord> {
			ensureProduct(await dependencies.repository.findProductById(productId));

			if (input.categoryId && !(await dependencies.repository.findCategoryById(input.categoryId))) {
				throw new AppError(
					404,
					'CATEGORY_NOT_FOUND',
					'The referenced product category could not be found.'
				);
			}

			if (input.slug && (await dependencies.repository.productSlugExists(input.slug, productId))) {
				throw new AppError(
					409,
					'PRODUCT_SLUG_CONFLICT',
					'The requested product slug is already in use.'
				);
			}

			return dependencies.repository.updateProduct(productId, input);
		},

		async deleteProduct(
			productId: string,
			input: {
				force: boolean;
			}
		): Promise<'soft' | 'force'> {
			const existingProduct = ensureProduct(
				await dependencies.repository.findProductById(productId, {
					includeSkus: true,
					includeImages: false
				})
			);

			if (input.force && existingProduct.skus.length > 0) {
				throw new AppError(
					409,
					'PRODUCT_DELETE_CONFLICT',
					'Force deleting a product with assigned SKUs is not allowed.'
				);
			}

			if (input.force) {
				await dependencies.repository.forceDeleteProduct(productId);
				return 'force';
			}

			await dependencies.repository.softDeleteProduct(productId);
			return 'soft';
		}
	};
}

export type ProductService = ReturnType<typeof createProductService>;
