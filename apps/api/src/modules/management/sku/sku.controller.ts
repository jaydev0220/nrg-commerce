import type { RequestHandler } from 'express';

import {
	getValidatedBody,
	getValidatedParams,
	getValidatedQuery
} from '../../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../../utils/pagination.js';
import type { SkuService } from './sku.service.js';

type SkuManagementControllerDependencies = {
	skuService: SkuService;
};

type SkuParams = {
	skuId: string;
};
type SkuManagementController = {
	listSkus: RequestHandler;
	createSku: RequestHandler;
	getSku: RequestHandler;
	updateSku: RequestHandler;
	deleteSku: RequestHandler;
};

export function createSkuManagementController(dependencies: SkuManagementControllerDependencies) {
	const controller: SkuManagementController = {
		listSkus: async (request, response) => {
			const query = getValidatedQuery<Parameters<SkuService['listSkus']>[0]>(request);
			const result = await dependencies.skuService.listSkus(query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		},

		createSku: async (request, response) => {
			const body = getValidatedBody<Parameters<SkuService['createSku']>[0]>(request);
			const sku = await dependencies.skuService.createSku(body);
			response.status(201).location(`/api/management/products/skus/${sku.id}`).json(sku);
		},

		getSku: async (request, response) => {
			const params = getValidatedParams<SkuParams>(request);
			const query = getValidatedQuery<Parameters<SkuService['getSku']>[1]>(request);
			const sku = await dependencies.skuService.getSku(params.skuId, query);
			response.status(200).json(sku);
		},

		updateSku: async (request, response) => {
			const params = getValidatedParams<SkuParams>(request);
			const body = getValidatedBody<Parameters<SkuService['updateSku']>[1]>(request);
			const sku = await dependencies.skuService.updateSku(params.skuId, body);
			response.status(200).json(sku);
		},

		deleteSku: async (request, response) => {
			const params = getValidatedParams<SkuParams>(request);
			const query = getValidatedQuery<{ force: boolean }>(request);
			const mode = await dependencies.skuService.deleteSku(params.skuId, query);
			response.status(200).json({
				deleted: true,
				mode
			});
		}
	};

	return controller;
}
