import type { RequestHandler } from 'express';

import {
	getValidatedBody,
	getValidatedParams,
	getValidatedQuery
} from '../../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../../utils/pagination.js';
import type { ImageService } from './image.service.js';

type ImageManagementControllerDependencies = {
	imageService: ImageService;
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
	deleteImage: RequestHandler;
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
			const params = getValidatedParams<SkuParams>(request);
			const body = getValidatedBody<Parameters<ImageService['createImage']>[1]>(request);
			const image = await dependencies.imageService.createImage(params.skuId, body);
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

		deleteImage: async (request, response) => {
			const params = getValidatedParams<ImageParams>(request);
			const query = getValidatedQuery<Parameters<ImageService['deleteImage']>[2]>(request);
			const result = await dependencies.imageService.deleteImage(
				params.skuId,
				params.imageId,
				query
			);

			response.status(200).json({
				deleted: true,
				mode: result.mode,
				assetDeleted: result.assetDeleted
			});
		}
	};

	return controller;
}
