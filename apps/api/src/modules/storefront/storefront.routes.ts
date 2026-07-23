import { Router } from 'express';
import {
	z,
	resourceSlugSchema,
	storefrontCategoryDetailQuerySchema,
	storefrontCategoryListQuerySchema,
	storefrontProductDetailQuerySchema,
	storefrontProductListQuerySchema,
	storefrontSkuDetailQuerySchema,
	storefrontSkuListQuerySchema
} from '@packages/schemas';

import { validateRequest } from '../../middlewares/validate-request.js';
import { createStorefrontCatalogController } from './storefront.controller.js';
import type { StorefrontCatalogService } from './storefront.service.js';

type StorefrontRouterDependencies = {
	storefrontService: StorefrontCatalogService;
	cacheTtlSeconds?: number;
};

const skuCodeParamsSchema = z.object({
	skuCode: z.string().trim().min(1).max(120)
});

const productParamsSchema = z.object({
	productSlug: resourceSlugSchema
});

const categorySlugParamsSchema = z.object({
	categorySlug: resourceSlugSchema
});

export function createStorefrontCatalogRouter(dependencies: StorefrontRouterDependencies): Router {
	const controller = createStorefrontCatalogController(dependencies);
	const router = Router();

	router.get(
		'/',
		validateRequest({ query: storefrontProductListQuerySchema }),
		controller.listProducts
	);

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

	router.get(
		'/:productSlug',
		validateRequest({ params: productParamsSchema, query: storefrontProductDetailQuerySchema }),
		controller.getProductById
	);

	return router;
}
