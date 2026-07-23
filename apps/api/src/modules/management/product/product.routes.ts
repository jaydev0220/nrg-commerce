import { Router, type RequestHandler } from 'express';
import {
	z,
	managementProductDetailQuerySchema,
	managementProductListQuerySchema,
	productBulkUpdateSchema,
	productCreateSchema,
	productUpdateSchema,
	uuidSchema
} from '@packages/schemas';

import { requireAuthContext } from '../../../middlewares/authenticate.js';
import { requirePermission } from '../../../middlewares/authorize.js';
import { AppError } from '../../../errors/app-error.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import type { LogService } from '../log/log.service.js';
import { createProductManagementController } from './product.controller.js';
import type { ProductService } from './product.service.js';

type ProductManagementRouterDependencies = {
	productService: ProductService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

const productParamsSchema = z.object({
	productId: uuidSchema
});

const requireBulkPermission: RequestHandler = (request, response, next) => {
	try {
		const authContext = requireAuthContext(response);
		const permission = request.body?.action === 'archive' ? 'product.delete' : 'product.update';
		if (!authContext.permissions.includes(permission)) {
			throw new AppError(
				403,
				'FORBIDDEN',
				'The authenticated staff account does not have permission to perform this action.'
			);
		}
		next();
	} catch (error) {
		next(error);
	}
};

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

	router.patch(
		'/bulk',
		validateRequest({ body: productBulkUpdateSchema }),
		requireBulkPermission,
		controller.bulkUpdateProducts
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
		validateRequest({ params: productParamsSchema }),
		controller.deleteProduct
	);

	router.post(
		'/:productId/restore',
		requirePermission('product.update'),
		validateRequest({ params: productParamsSchema }),
		controller.restoreProduct
	);

	return router;
}
