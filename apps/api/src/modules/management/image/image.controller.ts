import type { RequestHandler } from 'express';

import { requireAuthContext } from '../../../middlewares/authenticate.js';
import { getRequestContext, getRequestPath } from '../../../middlewares/request-context.js';
import {
	getValidatedBody,
	getValidatedParams,
	getValidatedQuery
} from '../../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../../utils/pagination.js';
import type { LogService } from '../log/log.service.js';
import type { ImageService } from './image.service.js';

type ImageManagementControllerDependencies = {
	imageService: ImageService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

type SkuParams = {
	skuId: string;
};

type ImageParams = {
	skuId: string;
	imageId: string;
};
type ImageManagementController = {
	listImages: RequestHandler;
	createImageUploadTarget: RequestHandler;
	createImage: RequestHandler;
	getImage: RequestHandler;
	updateImageCrop: RequestHandler;
	deleteImage: RequestHandler;
	restoreImage: RequestHandler;
};

export function createImageManagementController(
	dependencies: ImageManagementControllerDependencies
) {
	const controller: ImageManagementController = {
		listImages: async (request, response) => {
			const params = getValidatedParams<SkuParams>(request);
			const query = getValidatedQuery<Parameters<ImageService['listImages']>[1]>(request);
			const result = await dependencies.imageService.listImages(params.skuId, query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		},

		createImageUploadTarget: async (request, response) => {
			const params = getValidatedParams<SkuParams>(request);
			const body =
				getValidatedBody<Parameters<ImageService['createImageUploadTarget']>[1]>(request);
			const uploadTarget = await dependencies.imageService.createImageUploadTarget(
				params.skuId,
				body
			);

			response.status(200).json(uploadTarget);
		},

		createImage: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<SkuParams>(request);
			const body = getValidatedBody<Parameters<ImageService['createImage']>[1]>(request);
			const image = await dependencies.imageService.createImage(params.skuId, body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff created a product image.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 201,
				entityType: 'product_image',
				entityId: image.id,
				metadata: { skuId: params.skuId }
			});
			response
				.status(201)
				.location(`/api/management/products/skus/${params.skuId}/images/${image.id}`)
				.json(image);
		},

		getImage: async (request, response) => {
			const params = getValidatedParams<ImageParams>(request);
			const image = await dependencies.imageService.getImage(params.skuId, params.imageId);
			response.status(200).json(image);
		},

		updateImageCrop: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<ImageParams>(request);
			const body = getValidatedBody<Parameters<ImageService['updateImageCrop']>[2]>(request);
			const image = await dependencies.imageService.updateImageCrop(
				params.skuId,
				params.imageId,
				body
			);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated a product image crop.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product_image',
				entityId: image.id,
				metadata: { skuId: params.skuId, focusX: body.focusX, focusY: body.focusY, zoom: body.zoom }
			});
			response.status(200).json(image);
		},

		deleteImage: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<ImageParams>(request);
			const query = getValidatedQuery<Parameters<ImageService['deleteImage']>[2]>(request);
			const result = await dependencies.imageService.deleteImage(
				params.skuId,
				params.imageId,
				query
			);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff deleted a product image.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product_image',
				entityId: params.imageId,
				metadata: {
					skuId: params.skuId,
					mode: result.mode,
					assetDeleted: result.assetDeleted
				}
			});

			response.status(200).json({
				deleted: true,
				mode: result.mode,
				assetDeleted: result.assetDeleted
			});
		},

		restoreImage: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<ImageParams>(request);
			const image = await dependencies.imageService.restoreImage(params.skuId, params.imageId);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff restored a product image.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product_image',
				entityId: image.id,
				metadata: { skuId: params.skuId }
			});
			response.status(200).json(image);
		}
	};

	return controller;
}
