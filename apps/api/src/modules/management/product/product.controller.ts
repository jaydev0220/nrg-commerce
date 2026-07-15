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
import type { ProductService } from './product.service.js';

type ProductManagementControllerDependencies = {
	productService: ProductService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

type ProductParams = {
	productId: string;
};

type ProductManagementController = {
	listProducts: RequestHandler;
	createProduct: RequestHandler;
	getProduct: RequestHandler;
	updateProduct: RequestHandler;
	deleteProduct: RequestHandler;
	restoreProduct: RequestHandler;
	bulkUpdateProducts: RequestHandler;
};

export function createProductManagementController(
	dependencies: ProductManagementControllerDependencies
) {
	const controller: ProductManagementController = {
		listProducts: async (request, response) => {
			const query = getValidatedQuery<Parameters<ProductService['listProducts']>[0]>(request);
			const result = await dependencies.productService.listProducts(query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		},

		createProduct: async (request, response) => {
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<Parameters<ProductService['createProduct']>[0]>(request);
			const product = await dependencies.productService.createProduct(body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff created a product.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 201,
				entityType: 'product',
				entityId: product.id
			});
			response.status(201).location(`/api/management/products/${product.id}`).json(product);
		},

		getProduct: async (request, response) => {
			const params = getValidatedParams<ProductParams>(request);
			const query = getValidatedQuery<Parameters<ProductService['getProduct']>[1]>(request);
			const product = await dependencies.productService.getProduct(params.productId, query);
			response.status(200).json(product);
		},

		updateProduct: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<ProductParams>(request);
			const body = getValidatedBody<Parameters<ProductService['updateProduct']>[1]>(request);
			const product = await dependencies.productService.updateProduct(params.productId, body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated a product.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product',
				entityId: product.id
			});
			response.status(200).json(product);
		},

		deleteProduct: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<ProductParams>(request);
			const query = getValidatedQuery<Parameters<ProductService['deleteProduct']>[1]>(request);
			const mode = await dependencies.productService.deleteProduct(params.productId, query);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff deleted a product.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product',
				entityId: params.productId,
				metadata: { mode }
			});
			response.status(200).json({
				deleted: true,
				mode
			});
		},

		restoreProduct: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<ProductParams>(request);
			const product = await dependencies.productService.restoreProduct(params.productId);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff restored a product.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product',
				entityId: product.id
			});
			response.status(200).json(product);
		},

		bulkUpdateProducts: async (request, response) => {
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<Parameters<ProductService['bulkUpdateProducts']>[0]>(request);
			const updatedCount = await dependencies.productService.bulkUpdateProducts(body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated products in bulk.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product',
				metadata: { action: body.action, productCount: updatedCount }
			});
			response.status(200).json({ updatedCount });
		}
	};

	return controller;
}
