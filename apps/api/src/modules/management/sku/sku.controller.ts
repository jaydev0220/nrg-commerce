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
import type { SkuService } from './sku.service.js';

type SkuManagementControllerDependencies = {
	skuService: SkuService;
	logService: Pick<LogService, 'recordAuditLog'>;
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
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<Parameters<SkuService['createSku']>[0]>(request);
			const sku = await dependencies.skuService.createSku(body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff created a product SKU.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 201,
				entityType: 'product_sku',
				entityId: sku.id,
				metadata: { productId: sku.productId }
			});
			response.status(201).location(`/api/management/products/skus/${sku.id}`).json(sku);
		},

		getSku: async (request, response) => {
			const params = getValidatedParams<SkuParams>(request);
			const query = getValidatedQuery<Parameters<SkuService['getSku']>[1]>(request);
			const sku = await dependencies.skuService.getSku(params.skuId, query);
			response.status(200).json(sku);
		},

		updateSku: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<SkuParams>(request);
			const body = getValidatedBody<Parameters<SkuService['updateSku']>[1]>(request);
			const sku = await dependencies.skuService.updateSku(params.skuId, body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated a product SKU.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product_sku',
				entityId: sku.id,
				metadata: { productId: sku.productId }
			});
			response.status(200).json(sku);
		},

		deleteSku: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<SkuParams>(request);
			const query = getValidatedQuery<{ force: boolean }>(request);
			const mode = await dependencies.skuService.deleteSku(params.skuId, query);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff deleted a product SKU.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product_sku',
				entityId: params.skuId,
				metadata: { mode }
			});
			response.status(200).json({
				deleted: true,
				mode
			});
		}
	};

	return controller;
}
