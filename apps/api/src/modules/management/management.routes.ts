import { Router } from 'express';

import { createCategoryManagementRouter } from './category.routes.js';
import { createImageManagementRouter } from './image.routes.js';
import { createSkuManagementRouter } from './sku.routes.js';
import type { CategoryService } from './category.service.js';
import type { ImageService } from './image.service.js';
import type { SkuService } from './sku.service.js';

type CatalogManagementRouterDependencies = {
	categoryService: CategoryService;
	skuService: SkuService;
	imageService: ImageService;
};

export function createCatalogManagementRouter(
	dependencies: CatalogManagementRouterDependencies
): Router {
	const router = Router();

	router.use(createSkuManagementRouter({ skuService: dependencies.skuService }));
	router.use(createCategoryManagementRouter({ categoryService: dependencies.categoryService }));
	router.use(createImageManagementRouter({ imageService: dependencies.imageService }));

	return router;
}
