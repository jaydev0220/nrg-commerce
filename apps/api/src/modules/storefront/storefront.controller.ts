import type { RequestHandler } from 'express';

import { getValidatedParams, getValidatedQuery } from '../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../utils/pagination.js';
import type { StorefrontCatalogService } from './storefront.service.js';

type StorefrontControllerDependencies = {
	storefrontService: StorefrontCatalogService;
};

type SkuCodeParams = {
	skuCode: string;
};

type CategorySlugParams = {
	categorySlug: string;
};
type StorefrontCatalogController = {
	listSkus: RequestHandler;
	getSkuByCode: RequestHandler;
	listCategories: RequestHandler;
	getCategoryBySlug: RequestHandler;
};

export function createStorefrontCatalogController(dependencies: StorefrontControllerDependencies) {
	const controller: StorefrontCatalogController = {
		listSkus: async (request, response) => {
			const query = getValidatedQuery<Parameters<StorefrontCatalogService['listSkus']>[0]>(request);
			const result = await dependencies.storefrontService.listSkus(query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		},

		getSkuByCode: async (request, response) => {
			const params = getValidatedParams<SkuCodeParams>(request);
			const query =
				getValidatedQuery<Parameters<StorefrontCatalogService['getSkuByCode']>[1]>(request);
			const sku = await dependencies.storefrontService.getSkuByCode(params.skuCode, query);
			response.status(200).json(sku);
		},

		listCategories: async (request, response) => {
			const query =
				getValidatedQuery<Parameters<StorefrontCatalogService['listCategories']>[0]>(request);
			const categories = await dependencies.storefrontService.listCategories(query);
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
			response.status(200).json(category);
		}
	};

	return controller;
}
