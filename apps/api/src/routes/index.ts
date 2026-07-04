import type { Application, RequestHandler } from 'express';

import type { AppConfig } from '../config/app-config.js';
import { AppError } from '../errors/app-error.js';
import { errorHandler } from '../errors/error-handler.js';
import { createHealthRouter, type HealthDependencies } from '../health/health.routes.js';
import { createAuthRateLimiter } from '../middlewares/rate-limit.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import { createCatalogManagementRouter } from '../modules/management/management.routes.js';
import type { CategoryService } from '../modules/management/category/category.service.js';
import type { ImageService } from '../modules/management/image/image.service.js';
import type { ProductService } from '../modules/management/product/product.service.js';
import type { SkuService } from '../modules/management/sku/sku.service.js';
import { createStaffManagementRouter } from '../modules/management/staff/staff.routes.js';
import type { StaffService } from '../modules/management/staff/staff.service.js';
import { createStorefrontCatalogRouter } from '../modules/storefront/storefront.routes.js';
import type { StorefrontCatalogService } from '../modules/storefront/storefront.service.js';

type RouteDependencies = {
	config: AppConfig;
	health?: HealthDependencies;
	authService: AuthService;
	authenticate: RequestHandler;
	staffService: StaffService;
	productService: ProductService;
	categoryService: CategoryService;
	skuService: SkuService;
	imageService: ImageService;
	storefrontService: StorefrontCatalogService;
};

export function initializeRoutes(app: Application, dependencies: RouteDependencies): void {
	const authRouterDependencies: Parameters<typeof createAuthRouter>[0] = {
		authService: dependencies.authService,
		authRateLimiter: createAuthRateLimiter(dependencies.config),
		authenticate: dependencies.authenticate
	};

	app.use('/health', createHealthRouter(dependencies.health ?? { isReady: async () => true }));
	app.use('/api/auth', createAuthRouter(authRouterDependencies));
	app.use(
		'/api/storefront/products',
		createStorefrontCatalogRouter({ storefrontService: dependencies.storefrontService })
	);

	app.use('/api/management', dependencies.authenticate);
	app.use(
		'/api/management/staff',
		createStaffManagementRouter({ staffService: dependencies.staffService })
	);
	app.use(
		'/api/management/products',
		createCatalogManagementRouter({
			productService: dependencies.productService,
			categoryService: dependencies.categoryService,
			skuService: dependencies.skuService,
			imageService: dependencies.imageService
		})
	);

	app.use((request, _response, next) => {
		next(
			new AppError(404, 'ROUTE_NOT_FOUND', `Route ${request.method} ${request.path} was not found.`)
		);
	});
	app.use(errorHandler);
}
