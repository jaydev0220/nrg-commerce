import { Router } from 'express';
import {
	storefrontCategoryDetailQuerySchema,
	storefrontCategoryListQuerySchema,
	storefrontCategoryResponseSchema,
	storefrontCategoryTreeListResponseSchema,
	storefrontProductDetailQuerySchema,
	storefrontProductListQuerySchema,
	storefrontProductListResponseSchema,
	storefrontProductResponseSchema
} from '@packages/schemas';
import { MockHttpError, notFound } from '../http/errors.js';
import { compareValues, paginate } from '../http/pagination.js';
import { parseQuery, sendJson } from '../http/validation.js';
import type { MockCategory, MockProduct, MockState } from '../state.js';
import {
	assertDomainHealthy,
	projectStorefrontCategory,
	projectStorefrontProduct
} from './shared.js';

function activeCategories(state: MockState): MockCategory[] {
	return state.categories.filter((category) => category.deletedAt === null);
}

function findCategoryBySlug(state: MockState, slug: string): MockCategory {
	return (
		activeCategories(state).find((category) => category.slug === slug) ??
		notFound('The requested storefront product category could not be found.')
	);
}

function descendantIds(state: MockState, categoryId: string): Set<string> {
	const result = new Set<string>([categoryId]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const category of activeCategories(state)) {
			if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
				result.add(category.id);
				changed = true;
			}
		}
	}
	return result;
}

function categoryTree(
	state: MockState,
	category: MockCategory,
	withCount: boolean
): Record<string, unknown> {
	return {
		...projectStorefrontCategory(state, category, withCount),
		children: activeCategories(state)
			.filter((child) => child.parentId === category.id)
			.sort((left, right) => left.position - right.position)
			.map((child) => categoryTree(state, child, withCount))
	};
}

function minPrice(state: MockState, product: MockProduct): number {
	const prices = state.skus
		.filter((sku) => sku.productId === product.id && sku.deletedAt === null)
		.map((sku) => sku.price);
	return prices.length === 0 ? 0 : Math.min(...prices);
}

export function createStorefrontRouter(state: MockState, publicOrigin: string): Router {
	const router = Router();

	router.get('/products/categories', (request, response) => {
		assertDomainHealthy(state, 'storefront');
		const query = parseQuery(request, storefrontCategoryListQuerySchema);
		let categories = activeCategories(state);
		if (query.parentSlug) {
			const parent = findCategoryBySlug(state, query.parentSlug);
			categories = categories.filter((category) => category.parentId === parent.id);
		} else if (query.includeTree) {
			categories = categories.filter((category) => category.parentId === null);
		}
		categories = [...categories].sort((left, right) => left.position - right.position);
		const data = query.includeTree
			? categories.map((category) => categoryTree(state, category, query.includeProductCount))
			: categories.map((category) => ({
					...projectStorefrontCategory(state, category, query.includeProductCount),
					children: []
				}));
		sendJson(response, storefrontCategoryTreeListResponseSchema, { data });
	});

	router.get('/products/categories/:categorySlug', (request, response) => {
		assertDomainHealthy(state, 'storefront');
		const query = parseQuery(request, storefrontCategoryDetailQuerySchema);
		const category = findCategoryBySlug(state, request.params['categorySlug'] ?? '');
		const payload = {
			...projectStorefrontCategory(state, category, query.includeProductCount),
			...(query.includeChildren
				? {
						children: activeCategories(state)
							.filter((child) => child.parentId === category.id)
							.sort((left, right) => left.position - right.position)
							.map((child) => projectStorefrontCategory(state, child, query.includeProductCount))
					}
				: {})
		};
		sendJson(response, storefrontCategoryResponseSchema, payload);
	});

	router.get('/products', (request, response) => {
		assertDomainHealthy(state, 'storefront');
		const query = parseQuery(request, storefrontProductListQuerySchema);
		const search = query.search?.toLocaleLowerCase();
		let categoryIds: Set<string> | null = null;
		if (query.categorySlug)
			categoryIds = descendantIds(state, findCategoryBySlug(state, query.categorySlug).id);
		let products = state.products.filter((product) => {
			if (product.deletedAt || !product.published) return false;
			const activeSkus = state.skus.filter(
				(sku) => sku.productId === product.id && sku.deletedAt === null
			);
			if (query.includeSkus && activeSkus.length === 0) return false;
			if (categoryIds && (!product.categoryId || !categoryIds.has(product.categoryId)))
				return false;
			if (!search) return true;
			return [product.name, product.nameEn, product.slug, ...activeSkus.map((sku) => sku.skuCode)]
				.filter((value): value is string => Boolean(value))
				.some((value) => value.toLocaleLowerCase().includes(search));
		});
		products = [...products].sort((left, right) => {
			const leftValue = query.sort === 'minPrice' ? minPrice(state, left) : left[query.sort];
			const rightValue = query.sort === 'minPrice' ? minPrice(state, right) : right[query.sort];
			return compareValues(leftValue, rightValue, query.order);
		});
		const page = paginate(products, query);
		sendJson(response, storefrontProductListResponseSchema, {
			...page,
			data: page.data.map((product) =>
				projectStorefrontProduct(state, product, publicOrigin, {
					includeSkus: query.includeSkus,
					includeImages: query.includeImages
				})
			)
		});
	});

	router.get('/products/:productSlug', (request, response) => {
		assertDomainHealthy(state, 'storefront');
		const query = parseQuery(request, storefrontProductDetailQuerySchema);
		const product = state.products.find(
			(entry) =>
				entry.slug === request.params['productSlug'] && entry.deletedAt === null && entry.published
		);
		if (!product) {
			throw new MockHttpError(
				404,
				'PRODUCT_NOT_FOUND',
				'The requested storefront product could not be found.'
			);
		}
		sendJson(
			response,
			storefrontProductResponseSchema,
			projectStorefrontProduct(state, product, publicOrigin, {
				includeSkus: query.includeSkus,
				includeImages: query.includeImages
			})
		);
	});

	return router;
}
