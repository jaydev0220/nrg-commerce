import { Router } from 'express';
import {
	z,
	managementProductImageListQuerySchema,
	productImageCreateSchema,
	productImageDeleteQuerySchema,
	productImageFocusUpdateSchema,
	productImageUploadRequestSchema,
	uuidSchema
} from '@packages/schemas';

import { requirePermission } from '../../../middlewares/authorize.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import type { LogService } from '../log/log.service.js';
import { createImageManagementController } from './image.controller.js';
import type { ImageService } from './image.service.js';

type ImageManagementRouterDependencies = {
	imageService: ImageService;
	logService: Pick<LogService, 'recordAuditLog'>;
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

	router.patch(
		'/skus/:skuId/images/:imageId/focus',
		requirePermission('product.image.update'),
		validateRequest({ params: imageParamsSchema, body: productImageFocusUpdateSchema }),
		controller.updateImageFocus
	);

	router.delete(
		'/skus/:skuId/images/:imageId',
		requirePermission('product.image.delete'),
		validateRequest({ params: imageParamsSchema, query: productImageDeleteQuerySchema }),
		controller.deleteImage
	);

	router.post(
		'/skus/:skuId/images/:imageId/restore',
		requirePermission('product.image.delete'),
		validateRequest({ params: imageParamsSchema }),
		controller.restoreImage
	);

	return router;
}
