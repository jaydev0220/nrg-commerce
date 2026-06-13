import { Router } from 'express';
import {
	z,
	managementProductImageListQuerySchema,
	productImageCreateSchema,
	productImageDeleteQuerySchema,
	productImageUploadRequestSchema,
	uuidSchema
} from '@packages/schemas';

import { requirePermission } from '../../middlewares/authorize.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { createImageManagementController } from './image.controller.js';
import type { ImageService } from './image.service.js';

type ImageManagementRouterDependencies = {
	imageService: ImageService;
};

const skuParamsSchema = z.object({
	skuId: uuidSchema
});

const imageParamsSchema = z.object({
	skuId: uuidSchema,
	imageId: uuidSchema
});

export function createImageManagementRouter(
	dependencies: ImageManagementRouterDependencies
): Router {
	const controller = createImageManagementController(dependencies);
	const router = Router();

	router.get(
		'/skus/:skuId/images',
		requirePermission('product.image.read'),
		validateRequest({ params: skuParamsSchema, query: managementProductImageListQuerySchema }),
		controller.listImages
	);

	router.post(
		'/skus/:skuId/images/upload-url',
		requirePermission('product.image.create'),
		validateRequest({ params: skuParamsSchema, body: productImageUploadRequestSchema }),
		controller.createImageUploadTarget
	);

	router.post(
		'/skus/:skuId/images',
		requirePermission('product.image.create'),
		validateRequest({ params: skuParamsSchema, body: productImageCreateSchema }),
		controller.createImage
	);

	router.get(
		'/skus/:skuId/images/:imageId',
		requirePermission('product.image.read'),
		validateRequest({ params: imageParamsSchema }),
		controller.getImage
	);

	router.delete(
		'/skus/:skuId/images/:imageId',
		requirePermission('product.image.delete'),
		validateRequest({ params: imageParamsSchema, query: productImageDeleteQuerySchema }),
		controller.deleteImage
	);

	return router;
}
