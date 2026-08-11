import { AppError } from '../../errors/app-error.js';

import type {
	CatalogCategoryDetailRecord,
	CatalogCategoryRecord,
	CatalogCategoryTreeRecord,
	CatalogJsonValue,
	CatalogProductRecord,
	CatalogSkuRecord
} from '../../types/catalog.js';
import { buildCategoryTree } from '../../utils/catalog.js';

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

function throwInvalidCategoryHierarchy(): never {
	throw new AppError(
		500,
		'CATEGORY_HIERARCHY_INVALID',
		'The storefront category hierarchy is invalid.'
	);
}

function getCategoryDescendantIds(
	categories: CatalogCategoryRecord[],
	rootCategoryId: string
): string[] {
	const childrenByParentId = new Map<string, CatalogCategoryRecord[]>();

	for (const category of categories) {
		if (!category.parentId) continue;
		const children = childrenByParentId.get(category.parentId) ?? [];
		children.push(category);
		childrenByParentId.set(category.parentId, children);
	}

	const ids: string[] = [];
	const visited = new Set<string>();
	const pending = [rootCategoryId];
	while (pending.length > 0) {
		const categoryId = pending.pop();
		if (!categoryId) continue;
		if (visited.has(categoryId)) throwInvalidCategoryHierarchy();
		visited.add(categoryId);
		ids.push(categoryId);

		const children = childrenByParentId.get(categoryId) ?? [];
		for (let index = children.length - 1; index >= 0; index -= 1) {
			const child = children[index];
			if (child) pending.push(child.id);
		}
	}

	return ids;
}

function createCategoryAggregationState(
	categories: CatalogCategoryRecord[],
	directCounts: Record<string, number>
) {
	const categoriesById = new Map(categories.map((category) => [category.id, category]));
	if (categoriesById.size !== categories.length) throwInvalidCategoryHierarchy();

	const totals = new Map(
		categories.map((category) => [category.id, directCounts[category.id] ?? 0])
	);
	const remainingChildren = new Map(categories.map((category) => [category.id, 0]));
	for (const category of categories) {
		if (!category.parentId || !categoriesById.has(category.parentId)) continue;
		remainingChildren.set(category.parentId, (remainingChildren.get(category.parentId) ?? 0) + 1);
	}

	return { categoriesById, totals, remainingChildren };
}

function aggregateCategoryCounts(
	categories: CatalogCategoryRecord[],
	directCounts: Record<string, number>
): Record<string, number> {
	const state = createCategoryAggregationState(categories, directCounts);
	const pending = categories
		.filter((category) => state.remainingChildren.get(category.id) === 0)
		.map((category) => category.id);
	let processed = 0;
	while (pending.length > 0) {
		const categoryId = pending.pop();
		if (!categoryId) continue;
		const category = state.categoriesById.get(categoryId);
		if (!category) throwInvalidCategoryHierarchy();
		processed += 1;

		if (!category.parentId || !state.categoriesById.has(category.parentId)) continue;
		state.totals.set(
			category.parentId,
			(state.totals.get(category.parentId) ?? 0) + (state.totals.get(categoryId) ?? 0)
		);
		const nextRemaining = (state.remainingChildren.get(category.parentId) ?? 0) - 1;
		state.remainingChildren.set(category.parentId, nextRemaining);
		if (nextRemaining === 0) pending.push(category.parentId);
	}

	if (processed !== categories.length) throwInvalidCategoryHierarchy();
	return Object.fromEntries(state.totals);
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
	async function getCategoryVisibility() {
		const allCategories = await dependencies.repository.listCategories(
			{ sort: 'position', order: 'asc' },
			{ paginate: false }
		);
		const directProductCounts = await dependencies.repository.countProductsForCategoryIds(
			allCategories.data.map((category) => category.id),
			true
		);
		const productCounts = aggregateCategoryCounts(allCategories.data, directProductCounts);
		const visibleCategories = allCategories.data.filter(
			(category) => (productCounts[category.id] ?? 0) > 0
		);

		return { allCategories, productCounts, visibleCategories };
	}

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
			const { productCounts, visibleCategories } = await getCategoryVisibility();
			let result = visibleCategories;

			if (query.parentSlug) {
				const parent = ensureCategory(
					visibleCategories.find((category) => category.slug === query.parentSlug) ?? null
				);
				result = visibleCategories.filter((category) => category.parentId === parent.id);
			}

			if (query.includeTree) {
				return buildCategoryTree(result, query.includeProductCount ? productCounts : undefined);
			}

			return result.map((category) => ({
				...category,
				...(query.includeProductCount ? { productCount: productCounts[category.id] } : {})
			}));
		},

		async getCategoryBySlug(
			categorySlug: string,
			query: {
				includeChildren: boolean;
				includeProductCount: boolean;
			}
		): Promise<CatalogCategoryDetailRecord> {
			const { allCategories, productCounts, visibleCategories } = await getCategoryVisibility();
			const category = ensureCategory(
				allCategories.data.find(
					(entry) => entry.slug === categorySlug && (productCounts[entry.id] ?? 0) > 0
				) ?? null
			);
			const detail: CatalogCategoryDetailRecord = { ...category };

			if (query.includeChildren) {
				const visibleCategoryIds = new Set(visibleCategories.map((entry) => entry.id));
				detail.children = (await dependencies.repository.listChildCategories(category.id)).filter(
					(entry) => visibleCategoryIds.has(entry.id)
				);
			}

			if (query.includeProductCount) {
				detail.productCount = productCounts[category.id];
			}

			return detail;
		}
	};
}

export type StorefrontCatalogService = ReturnType<typeof createStorefrontCatalogService>;
