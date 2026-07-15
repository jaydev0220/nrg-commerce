import { AppError } from '../../../errors/app-error.js';
import type { CatalogProductRecord } from '../../../types/catalog.js';

import type { CatalogRepository } from '../catalog.repository.js';

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
	includeDeleted: boolean;
	archived?: boolean;
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
		| 'restoreProduct'
		| 'forceDeleteProduct'
		| 'bulkUpdateProducts'
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
			categoryId?: string | null;
			published: boolean;
		}): Promise<CatalogProductRecord> {
			if (input.categoryId && !(await dependencies.repository.findCategoryById(input.categoryId))) {
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
				categoryId?: string | null;
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
		},

		async restoreProduct(productId: string): Promise<CatalogProductRecord> {
			const product = ensureProduct(
				await dependencies.repository.findProductById(productId, {
					includeSkus: false,
					includeImages: false,
					includeDeleted: true
				})
			);
			if (!product.deletedAt) {
				throw new AppError(409, 'PRODUCT_NOT_DELETED', 'The product is not archived.');
			}
			return dependencies.repository.restoreProduct(productId);
		},

		async bulkUpdateProducts(input: {
			productIds: string[];
			action: 'archive' | 'restore' | 'publish' | 'unpublish';
		}): Promise<number> {
			const result = await dependencies.repository.bulkUpdateProducts(input);
			if (result.missingProductIds.length > 0 || result.invalidProductIds.length > 0) {
				throw new AppError(
					409,
					'PRODUCT_BULK_UPDATE_CONFLICT',
					'One or more selected products are unavailable for this bulk action.'
				);
			}
			return result.updatedCount;
		}
	};
}

export type ProductService = ReturnType<typeof createProductService>;
