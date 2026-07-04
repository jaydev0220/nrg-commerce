import { Router } from 'express';
import {
	z,
	managementSkuDetailQuerySchema,
	managementSkuListQuerySchema,
	productSkuCreateSchema,
	productSkuDeleteQuerySchema,
	productSkuUpdateSchema,
	uuidSchema
} from '@packages/schemas';

import { requirePermission } from '../../../middlewares/authorize.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import { createSkuManagementController } from './sku.controller.js';
import type { SkuService } from './sku.service.js';

type SkuManagementRouterDependencies = {
	skuService: SkuService;
};

const skuParamsSchema = z.object({
	skuId: uuidSchema
});

export function createSkuManagementRouter(dependencies: SkuManagementRouterDependencies): Router {
	const controller = createSkuManagementController(dependencies);
	const router = Router();

	router.get(
		'/skus',
		requirePermission('product.sku.read'),
		validateRequest({ query: managementSkuListQuerySchema }),
		controller.listSkus
	);

	router.post(
		'/skus',
		requirePermission('product.sku.create'),
		validateRequest({ body: productSkuCreateSchema }),
		controller.createSku
	);

	router.get(
		'/skus/:skuId',
		requirePermission('product.sku.read'),
		validateRequest({ params: skuParamsSchema, query: managementSkuDetailQuerySchema }),
		controller.getSku
	);

	router.patch(
		'/skus/:skuId',
		requirePermission('product.sku.update'),
		validateRequest({ params: skuParamsSchema, body: productSkuUpdateSchema }),
		controller.updateSku
	);

	router.delete(
		'/skus/:skuId',
		requirePermission('product.sku.delete'),
		validateRequest({ params: skuParamsSchema, query: productSkuDeleteQuerySchema }),
		controller.deleteSku
	);

	return router;
}
