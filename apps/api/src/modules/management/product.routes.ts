import { Router } from 'express';
import {
	z,
	managementProductDetailQuerySchema,
	managementProductListQuerySchema,
	productCreateSchema,
	productDeleteQuerySchema,
	productUpdateSchema,
	uuidSchema
} from '@packages/schemas';

import { requirePermission } from '../../middlewares/authorize.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { createProductManagementController } from './product.controller.js';
import type { ProductService } from './product.service.js';

type ProductManagementRouterDependencies = {
	productService: ProductService;
};

const productParamsSchema = z.object({
	productId: uuidSchema
});

export function createProductManagementRouter(
	dependencies: ProductManagementRouterDependencies
): Router {
	const controller = createProductManagementController(dependencies);
	const router = Router();

	router.get(
		'/',
		requirePermission('product.read'),
		validateRequest({ query: managementProductListQuerySchema }),
		controller.listProducts
	);

	router.post(
		'/',
		requirePermission('product.create'),
		validateRequest({ body: productCreateSchema }),
		controller.createProduct
	);

	router.get(
		'/:productId',
		requirePermission('product.read'),
		validateRequest({ params: productParamsSchema, query: managementProductDetailQuerySchema }),
		controller.getProduct
	);

	router.patch(
		'/:productId',
		requirePermission('product.update'),
		validateRequest({ params: productParamsSchema, body: productUpdateSchema }),
		controller.updateProduct
	);

	router.delete(
		'/:productId',
		requirePermission('product.delete'),
		validateRequest({ params: productParamsSchema, query: productDeleteQuerySchema }),
		controller.deleteProduct
	);

	return router;
}
