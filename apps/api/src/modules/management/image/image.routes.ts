import { Router } from 'express';
import {
	z,
	managementProductImageListQuerySchema,
	productImageCreateSchema,
	productImageDeleteQuerySchema,
	productImageCropUpdateSchema,
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

const productParamsSchema = z.object({
	productId: uuidSchema
});

const imageParamsSchema = z.object({
	productId: uuidSchema,
	imageId: uuidSchema
});

export function createImageManagementRouter(
	dependencies: ImageManagementRouterDependencies
): Router {
	const controller = createImageManagementController(dependencies);
	const router = Router();

	router.get(
		'/:productId/images',
		requirePermission('product.image.read'),
		validateRequest({ params: productParamsSchema, query: managementProductImageListQuerySchema }),
		controller.listImages
	);

	router.post(
		'/:productId/images/upload-url',
		requirePermission('product.image.create'),
		validateRequest({ params: productParamsSchema, body: productImageUploadRequestSchema }),
		controller.createImageUploadTarget
	);

	router.post(
		'/:productId/images',
		requirePermission('product.image.create'),
		validateRequest({ params: productParamsSchema, body: productImageCreateSchema }),
		controller.createImage
	);

	router.get(
		'/:productId/images/:imageId',
		requirePermission('product.image.read'),
		validateRequest({ params: imageParamsSchema }),
		controller.getImage
	);

	router.patch(
		'/:productId/images/:imageId/crop',
		requirePermission('product.image.update'),
		validateRequest({ params: imageParamsSchema, body: productImageCropUpdateSchema }),
		controller.updateImageCrop
	);

	router.delete(
		'/:productId/images/:imageId',
		requirePermission('product.image.delete'),
		validateRequest({ params: imageParamsSchema, query: productImageDeleteQuerySchema }),
		controller.deleteImage
	);

	router.post(
		'/:productId/images/:imageId/restore',
		requirePermission('product.image.delete'),
		validateRequest({ params: imageParamsSchema }),
		controller.restoreImage
	);

	return router;
}
