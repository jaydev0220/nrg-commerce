import { AppError } from '../../errors/app-error.js';

import type {
	CatalogCategoryDetailRecord,
	CatalogCategoryRecord,
	CatalogCategoryTreeRecord,
	CatalogJsonValue,
	CatalogProductRecord,
	CatalogSkuRecord
} from '../../types/catalog.js';
import { buildCategoryTree, matchesAttributes } from '../../utils/catalog.js';

import type { StorefrontRepository } from './storefront.repository.js';

type StorefrontServiceDependencies = {
	repository: Pick<
		StorefrontRepository,
		| 'listCategories'
		| 'listProducts'
		| 'listSkus'
		| 'findProductById'
		| 'findSkuByCode'
		| 'findCategoryBySlug'
		| 'countProductsForCategoryIds'
		| 'countAssignedSkus'
		| 'listChildCategories'
	>;
};

type StorefrontSkuListQuery = {
	page: number;
	limit: number;
	search?: string;
	categorySlug?: string;
	minPrice?: number;
	maxPrice?: number;
	attributes?: Record<string, CatalogJsonValue>;
	includeImages: boolean;
	sort: 'name' | 'price' | 'createdAt';
	order: 'asc' | 'desc';
};

type StorefrontProductListQuery = {
	page: number;
	limit: number;
	search?: string;
	categorySlug?: string;
	includeSkus: boolean;
	includeImages: boolean;
	sort: 'name' | 'createdAt';
	order: 'asc' | 'desc';
};

function ensurePublishedProduct(product: CatalogProductRecord | null): CatalogProductRecord {
	if (!product || !product.published) {
		throw new AppError(
			404,
			'PRODUCT_NOT_FOUND',
			'The requested storefront product could not be found.'
		);
	}

	return product;
}

function ensurePublishedSku(sku: CatalogSkuRecord | null): CatalogSkuRecord {
	if (!sku || !sku.published) {
		throw new AppError(
			404,
			'SKU_NOT_FOUND',
			'The requested storefront product SKU could not be found.'
		);
	}

	return sku;
}

function paginateSkus(skus: CatalogSkuRecord[], page: number, limit: number): CatalogSkuRecord[] {
	const startIndex = (page - 1) * limit;
	return skus.slice(startIndex, startIndex + limit);
}

function ensureCategory(category: CatalogCategoryRecord | null): CatalogCategoryRecord {
	if (!category) {
		throw new AppError(
			404,
			'CATEGORY_NOT_FOUND',
			'The requested storefront product category could not be found.'
		);
	}

	return category;
}

export function createStorefrontCatalogService(dependencies: StorefrontServiceDependencies) {
	return {
		async listProducts(query: StorefrontProductListQuery): Promise<{
			data: CatalogProductRecord[];
			total: number;
		}> {
			const result = await dependencies.repository.listProducts(query, {
				includeSkus: query.includeSkus,
				includeImages: query.includeImages,
				publishedOnly: true
			});

			return {
				data: result.data.filter((product) => product.published),
				total: result.total
			};
		},

		async getProductById(
			productId: string,
			query: {
				includeSkus: boolean;
				includeImages: boolean;
			}
		): Promise<CatalogProductRecord> {
			return ensurePublishedProduct(
				await dependencies.repository.findProductById(productId, {
					includeSkus: query.includeSkus,
					includeImages: query.includeImages,
					publishedOnly: true
				})
			);
		},

		async listSkus(query: StorefrontSkuListQuery): Promise<{
			data: CatalogSkuRecord[];
			total: number;
		}> {
			const attributeFilters = query.attributes;

			if (attributeFilters) {
				const result = await dependencies.repository.listSkus(
					{
						search: query.search,
						categorySlug: query.categorySlug,
						minPrice: query.minPrice,
						maxPrice: query.maxPrice,
						sort: query.sort,
						order: query.order
					},
					{
						paginate: false,
						includeImages: query.includeImages,
						publishedOnly: true
					}
				);
				const filteredSkus = result.data.filter(
					(sku) => sku.published && matchesAttributes(sku.attributes, attributeFilters)
				);

				return {
					data: paginateSkus(filteredSkus, query.page, query.limit),
					total: filteredSkus.length
				};
			}

			const result = await dependencies.repository.listSkus(query, {
				includeImages: query.includeImages,
				publishedOnly: true
			});

			return {
				data: result.data.filter((sku) => sku.published),
				total: result.total
			};
		},

		async getSkuByCode(
			skuCode: string,
			query: {
				includeImages: boolean;
			}
		): Promise<CatalogSkuRecord> {
			return ensurePublishedSku(
				await dependencies.repository.findSkuByCode(skuCode, {
					includeImages: query.includeImages,
					publishedOnly: true
				})
			);
		},

		async listCategories(query: {
			parentSlug?: string;
			includeTree: boolean;
			includeProductCount: boolean;
		}): Promise<Array<CatalogCategoryRecord | CatalogCategoryTreeRecord>> {
			let parentId: string | undefined;

			if (query.parentSlug) {
				const parent = ensureCategory(
					await dependencies.repository.findCategoryBySlug(query.parentSlug)
				);
				parentId = parent.id;
			}

			const result = await dependencies.repository.listCategories(
				{
					parentId,
					sort: 'position',
					order: 'asc'
				},
				{
					paginate: false
				}
			);

			const productCounts = query.includeProductCount
				? await dependencies.repository.countProductsForCategoryIds(
						result.data.map((category) => category.id),
						true
					)
				: undefined;

			if (query.includeTree) {
				return buildCategoryTree(result.data, productCounts);
			}

			return result.data.map((category) => ({
				...category,
				...(productCounts ? { productCount: productCounts[category.id] } : {})
			}));
		},

		async getCategoryBySlug(
			categorySlug: string,
			query: {
				includeChildren: boolean;
				includeProductCount: boolean;
			}
		): Promise<CatalogCategoryDetailRecord> {
			const category = ensureCategory(
				await dependencies.repository.findCategoryBySlug(categorySlug)
			);
			const detail: CatalogCategoryDetailRecord = { ...category };

			if (query.includeChildren) {
				detail.children = await dependencies.repository.listChildCategories(category.id);
			}

			if (query.includeProductCount) {
				detail.productCount = await dependencies.repository.countAssignedSkus(category.id, true);
			}

			return detail;
		}
	};
}

export type StorefrontCatalogService = ReturnType<typeof createStorefrontCatalogService>;
