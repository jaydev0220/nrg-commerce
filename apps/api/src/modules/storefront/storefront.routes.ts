import { Router } from 'express';
import {
	z,
	storefrontCategoryDetailQuerySchema,
	storefrontCategoryListQuerySchema,
	storefrontSkuDetailQuerySchema,
	storefrontSkuListQuerySchema
} from '@packages/schemas';

import { validateRequest } from '../../middlewares/validate-request.js';
import { createStorefrontCatalogController } from './storefront.controller.js';
import type { StorefrontCatalogService } from './storefront.service.js';

type StorefrontRouterDependencies = {
	storefrontService: StorefrontCatalogService;
};

const skuCodeParamsSchema = z.object({
	skuCode: z.string().trim().min(1)
});

const categorySlugParamsSchema = z.object({
	categorySlug: z.string().trim().min(1)
});

export function createStorefrontCatalogRouter(dependencies: StorefrontRouterDependencies): Router {
	const controller = createStorefrontCatalogController(dependencies);
	const router = Router();

	router.get(
		'/skus',
		validateRequest({ query: storefrontSkuListQuerySchema }),
		controller.listSkus
	);

	router.get(
		'/skus/:skuCode',
		validateRequest({ params: skuCodeParamsSchema, query: storefrontSkuDetailQuerySchema }),
		controller.getSkuByCode
	);

	router.get(
		'/categories',
		validateRequest({ query: storefrontCategoryListQuerySchema }),
		controller.listCategories
	);

	router.get(
		'/categories/:categorySlug',
		validateRequest({
			params: categorySlugParamsSchema,
			query: storefrontCategoryDetailQuerySchema
		}),
		controller.getCategoryBySlug
	);

	return router;
}
