import { Router } from 'express';

import { createCategoryManagementRouter } from './category/category.routes.js';
import { createImageManagementRouter } from './image/image.routes.js';
import type { LogService } from './log/log.service.js';
import { createProductManagementRouter } from './product/product.routes.js';
import { createSkuManagementRouter } from './sku/sku.routes.js';
import type { CategoryService } from './category/category.service.js';
import type { ImageService } from './image/image.service.js';
import type { ProductService } from './product/product.service.js';
import type { SkuService } from './sku/sku.service.js';

type CatalogManagementRouterDependencies = {
	productService: ProductService;
	categoryService: CategoryService;
	skuService: SkuService;
	imageService: ImageService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

export function createCatalogManagementRouter(
	dependencies: CatalogManagementRouterDependencies
): Router {
	const router = Router();

	router.use(
		createSkuManagementRouter({
			skuService: dependencies.skuService,
			logService: dependencies.logService
		})
	);
	router.use(
		createCategoryManagementRouter({
			categoryService: dependencies.categoryService,
			logService: dependencies.logService
		})
	);
	router.use(
		createImageManagementRouter({
			imageService: dependencies.imageService,
			logService: dependencies.logService
		})
	);
	router.use(
		createProductManagementRouter({
			productService: dependencies.productService,
			logService: dependencies.logService
		})
	);

	return router;
}
