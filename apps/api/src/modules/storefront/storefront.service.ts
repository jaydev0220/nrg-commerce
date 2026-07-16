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
		| 'findProductBySlug'
		| 'findSkuByCode'
		| 'findCategoryBySlug'
		| 'countProductsForCategoryIds'
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
	sort: 'name' | 'createdAt' | 'minPrice';
	order: 'asc' | 'desc';
};

function ensurePublishedProduct(
	product: CatalogProductRecord | null,
	requireSku = false
): CatalogProductRecord {
	if (!product || !product.published || (requireSku && product.skus.length === 0)) {
		throw new AppError(
			404,
			'PRODUCT_NOT_FOUND',
			'The requested storefront product could not be found.'
		);
	}

	return product;
}

function getCategoryDescendantIds(
	categories: CatalogCategoryRecord[],
	rootCategoryId: string
): string[] {
	const childrenByParentId = new Map<string, CatalogCategoryRecord[]>();

	for (const category of categories) {
		if (!category.parentId) {
			continue;
		}

		const children = childrenByParentId.get(category.parentId) ?? [];
		children.push(category);
		childrenByParentId.set(category.parentId, children);
	}

	const ids: string[] = [];
	const visit = (categoryId: string) => {
		ids.push(categoryId);
		for (const child of childrenByParentId.get(categoryId) ?? []) {
			visit(child.id);
		}
	};

	visit(rootCategoryId);
	return ids;
}

function aggregateCategoryCounts(
	categories: CatalogCategoryRecord[],
	directCounts: Record<string, number>
): Record<string, number> {
	const childrenByParentId = new Map<string, CatalogCategoryRecord[]>();
	const totals = new Map<string, number>();

	for (const category of categories) {
		if (category.parentId) {
			const children = childrenByParentId.get(category.parentId) ?? [];
			children.push(category);
			childrenByParentId.set(category.parentId, children);
		}
	}

	const getTotal = (categoryId: string): number => {
		const cachedTotal = totals.get(categoryId);
		if (cachedTotal !== undefined) {
			return cachedTotal;
		}

		const total =
			(directCounts[categoryId] ?? 0) +
			(childrenByParentId.get(categoryId) ?? []).reduce(
				(sum, child) => sum + getTotal(child.id),
				0
			);
		totals.set(categoryId, total);
		return total;
	};

	for (const category of categories) {
		getTotal(category.id);
	}

	return Object.fromEntries(totals);
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
			let categoryIds: string[] | undefined;
			if (query.categorySlug) {
				const categories = await dependencies.repository.listCategories(
					{ sort: 'position', order: 'asc' },
					{ paginate: false }
				);
				const category = ensureCategory(
					categories.data.find((entry) => entry.slug === query.categorySlug) ?? null
				);
				categoryIds = getCategoryDescendantIds(categories.data, category.id);
			}

			const result = await dependencies.repository.listProducts(
				{ ...query, categoryIds, categorySlug: undefined },
				{
					includeSkus: query.includeSkus,
					includeImages: query.includeImages,
					publishedOnly: true
				}
			);

			return {
				data: result.data.filter(
					(product) => product.published && (!query.includeSkus || product.skus.length > 0)
				),
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
				}),
				query.includeSkus
			);
		},

		async getProductBySlug(
			productSlug: string,
			query: {
				includeSkus: boolean;
				includeImages: boolean;
			}
		): Promise<CatalogProductRecord> {
			return ensurePublishedProduct(
				await dependencies.repository.findProductBySlug(productSlug, {
					includeSkus: query.includeSkus,
					includeImages: query.includeImages,
					publishedOnly: true
				}),
				query.includeSkus
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

			const allCategories = await dependencies.repository.listCategories(
				{
					sort: 'position',
					order: 'asc'
				},
				{
					paginate: false
				}
			);
			const result = parentId
				? {
						...allCategories,
						data: allCategories.data.filter((category) => category.parentId === parentId)
					}
				: allCategories;

			const directProductCounts = query.includeProductCount
				? await dependencies.repository.countProductsForCategoryIds(
						allCategories.data.map((category) => category.id),
						true
					)
				: undefined;
			const productCounts = directProductCounts
				? aggregateCategoryCounts(allCategories.data, directProductCounts)
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
				const categories = await dependencies.repository.listCategories(
					{ sort: 'position', order: 'asc' },
					{ paginate: false }
				);
				const categoryIds = getCategoryDescendantIds(categories.data, category.id);
				const directProductCounts = await dependencies.repository.countProductsForCategoryIds(
					categoryIds,
					true
				);
				detail.productCount = categoryIds.reduce(
					(total, categoryId) => total + (directProductCounts[categoryId] ?? 0),
					0
				);
			}

			return detail;
		}
	};
}

export type StorefrontCatalogService = ReturnType<typeof createStorefrontCatalogService>;
