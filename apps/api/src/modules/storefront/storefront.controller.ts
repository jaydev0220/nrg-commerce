import type { RequestHandler } from 'express';

import { getValidatedParams, getValidatedQuery } from '../../middlewares/validate-request.js';
import type { CatalogProductRecord, CatalogSkuRecord } from '../../types/catalog.js';
import { buildPaginatedResponse } from '../../utils/pagination.js';
import type { StorefrontCatalogService } from './storefront.service.js';

type StorefrontControllerDependencies = {
	storefrontService: StorefrontCatalogService;
	cacheTtlSeconds?: number;
};

type ProductParams = {
	productSlug: string;
};

type SkuCodeParams = {
	skuCode: string;
};

type CategorySlugParams = {
	categorySlug: string;
};
type StorefrontCatalogController = {
	listProducts: RequestHandler;
	getProductById: RequestHandler;
	listSkus: RequestHandler;
	getSkuByCode: RequestHandler;
	listCategories: RequestHandler;
	getCategoryBySlug: RequestHandler;
};

function serializeSku(sku: CatalogSkuRecord, includeStructuredData = false) {
	const { stockQuantity, notes, structuredFields, structuredData, ...publicSku } = sku;
	void stockQuantity;
	void notes;
	void structuredFields;
	return includeStructuredData ? { ...publicSku, structuredData: structuredData ?? {} } : publicSku;
}

function serializeProduct(product: CatalogProductRecord, includeStructuredData = false) {
	const { notes, baseUnit, ...publicProduct } = product;
	void notes;
	void baseUnit;
	return {
		...publicProduct,
		skus: product.skus.map((sku) => serializeSku(sku, includeStructuredData))
	};
}

export function createStorefrontCatalogController(dependencies: StorefrontControllerDependencies) {
	const cacheTtlSeconds = dependencies.cacheTtlSeconds ?? 60;

	function markCacheable(response: Parameters<RequestHandler>[1]) {
		response.set('cache-control', `public, max-age=0, s-maxage=${cacheTtlSeconds}`);
	}

	const controller: StorefrontCatalogController = {
		listProducts: async (request, response) => {
			const query =
				getValidatedQuery<Parameters<StorefrontCatalogService['listProducts']>[0]>(request);
			const result = await dependencies.storefrontService.listProducts(query);
			markCacheable(response);
			response.status(200).json(
				buildPaginatedResponse(
					result.data.map((product) => serializeProduct(product)),
					{
						page: query.page,
						limit: query.limit,
						total: result.total
					}
				)
			);
		},

		getProductById: async (request, response) => {
			const params = getValidatedParams<ProductParams>(request);
			const query =
				getValidatedQuery<Parameters<StorefrontCatalogService['getProductBySlug']>[1]>(request);
			const product = await dependencies.storefrontService.getProductBySlug(
				params.productSlug,
				query
			);
			markCacheable(response);
			response.status(200).json(serializeProduct(product, true));
		},

		listSkus: async (request, response) => {
			const query = getValidatedQuery<Parameters<StorefrontCatalogService['listSkus']>[0]>(request);
			const result = await dependencies.storefrontService.listSkus(query);
			markCacheable(response);
			response.status(200).json(
				buildPaginatedResponse(
					result.data.map((sku) => serializeSku(sku)),
					{
						page: query.page,
						limit: query.limit,
						total: result.total
					}
				)
			);
		},

		getSkuByCode: async (request, response) => {
			const params = getValidatedParams<SkuCodeParams>(request);
			const query =
				getValidatedQuery<Parameters<StorefrontCatalogService['getSkuByCode']>[1]>(request);
			const sku = await dependencies.storefrontService.getSkuByCode(params.skuCode, query);
			markCacheable(response);
			response.status(200).json(serializeSku(sku));
		},

		listCategories: async (request, response) => {
			const query =
				getValidatedQuery<Parameters<StorefrontCatalogService['listCategories']>[0]>(request);
			const categories = await dependencies.storefrontService.listCategories(query);
			markCacheable(response);
			response.status(200).json({ data: categories });
		},

		getCategoryBySlug: async (request, response) => {
			const params = getValidatedParams<CategorySlugParams>(request);
			const query =
				getValidatedQuery<Parameters<StorefrontCatalogService['getCategoryBySlug']>[1]>(request);
			const category = await dependencies.storefrontService.getCategoryBySlug(
				params.categorySlug,
				query
			);
			markCacheable(response);
			response.status(200).json(category);
		}
	};

	return controller;
}
