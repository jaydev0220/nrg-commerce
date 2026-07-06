import { Router } from 'express';
import {
	z,
	managementCategoryListQuerySchema,
	productCategoryCreateSchema,
	productCategoryDeleteQuerySchema,
	productCategoryDetailQuerySchema,
	productCategoryUpdateSchema,
	uuidSchema
} from '@packages/schemas';

import { requirePermission } from '../../../middlewares/authorize.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import type { LogService } from '../log/log.service.js';
import { createCategoryManagementController } from './category.controller.js';
import type { CategoryService } from './category.service.js';

type CategoryManagementRouterDependencies = {
	categoryService: CategoryService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

const categoryParamsSchema = z.object({
	categoryId: uuidSchema
});

export function createCategoryManagementRouter(
	dependencies: CategoryManagementRouterDependencies
): Router {
	const controller = createCategoryManagementController(dependencies);
	const router = Router();

	router.get(
		'/categories',
		requirePermission('product.category.read'),
		validateRequest({ query: managementCategoryListQuerySchema }),
		controller.listCategories
	);

	router.post(
		'/categories',
		requirePermission('product.category.create'),
		validateRequest({ body: productCategoryCreateSchema }),
		controller.createCategory
	);

	router.get(
		'/categories/:categoryId',
		requirePermission('product.category.read'),
		validateRequest({ params: categoryParamsSchema, query: productCategoryDetailQuerySchema }),
		controller.getCategory
	);

	router.patch(
		'/categories/:categoryId',
		requirePermission('product.category.update'),
		validateRequest({ params: categoryParamsSchema, body: productCategoryUpdateSchema }),
		controller.updateCategory
	);

	router.delete(
		'/categories/:categoryId',
		requirePermission('product.category.delete'),
		validateRequest({ params: categoryParamsSchema, query: productCategoryDeleteQuerySchema }),
		controller.deleteCategory
	);

	return router;
}
