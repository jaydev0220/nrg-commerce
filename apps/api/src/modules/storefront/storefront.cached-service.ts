import type { ApiLogger } from '../../logging/logger.js';
import { createTtlLruCache, stableSerialize } from '../../cache/ttl-cache.js';
import type { StorefrontCatalogService } from './storefront.service.js';

type StorefrontCacheOptions = {
	ttlMs: number;
	maxEntries: number;
	logger?: Pick<ApiLogger, 'debug'>;
};

export function createCachedStorefrontCatalogService(
	service: StorefrontCatalogService,
	options: StorefrontCacheOptions
): StorefrontCatalogService {
	const cache = createTtlLruCache<string, unknown>({
		ttlMs: options.ttlMs,
		maxEntries: options.maxEntries,
		onEvent: (event, size) =>
			options.logger?.debug({ cache: 'storefront', event, size }, 'Storefront cache event.')
	});

	function cached<T>(operation: string, input: unknown, load: () => Promise<T>): Promise<T> {
		return cache.getOrLoad(`${operation}:${stableSerialize(input)}`, load) as Promise<T>;
	}

	return {
		listProducts: (query) => cached('listProducts', query, () => service.listProducts(query)),
		getProductById: (productId, query) =>
			cached('getProductById', { productId, query }, () =>
				service.getProductById(productId, query)
			),
		getProductBySlug: (productSlug, query) =>
			cached('getProductBySlug', { productSlug, query }, () =>
				service.getProductBySlug(productSlug, query)
			),
		listSkus: (query) => cached('listSkus', query, () => service.listSkus(query)),
		getSkuByCode: (skuCode, query) =>
			cached('getSkuByCode', { skuCode, query }, () => service.getSkuByCode(skuCode, query)),
		listCategories: (query) => cached('listCategories', query, () => service.listCategories(query)),
		getCategoryBySlug: (categorySlug, query) =>
			cached('getCategoryBySlug', { categorySlug, query }, () =>
				service.getCategoryBySlug(categorySlug, query)
			)
	};
}
