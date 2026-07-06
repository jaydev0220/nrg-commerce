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
import type { CategoryService } from './category.service.js';

type CategoryManagementControllerDependencies = {
	categoryService: CategoryService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

type CategoryParams = {
	categoryId: string;
};
type CategoryManagementController = {
	listCategories: RequestHandler;
	createCategory: RequestHandler;
	getCategory: RequestHandler;
	updateCategory: RequestHandler;
	deleteCategory: RequestHandler;
};

export function createCategoryManagementController(
	dependencies: CategoryManagementControllerDependencies
) {
	const controller: CategoryManagementController = {
		listCategories: async (request, response) => {
			const query = getValidatedQuery<Parameters<CategoryService['listCategories']>[0]>(request);
			const result = await dependencies.categoryService.listCategories(query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		},

		createCategory: async (request, response) => {
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<Parameters<CategoryService['createCategory']>[0]>(request);
			const category = await dependencies.categoryService.createCategory(body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff created a product category.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 201,
				entityType: 'product_category',
				entityId: category.id
			});
			response
				.status(201)
				.location(`/api/management/products/categories/${category.id}`)
				.json(category);
		},

		getCategory: async (request, response) => {
			const params = getValidatedParams<CategoryParams>(request);
			const query = getValidatedQuery<Parameters<CategoryService['getCategory']>[1]>(request);
			const category = await dependencies.categoryService.getCategory(params.categoryId, query);
			response.status(200).json(category);
		},

		updateCategory: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<CategoryParams>(request);
			const body = getValidatedBody<Parameters<CategoryService['updateCategory']>[1]>(request);
			const category = await dependencies.categoryService.updateCategory(params.categoryId, body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated a product category.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product_category',
				entityId: category.id
			});
			response.status(200).json(category);
		},

		deleteCategory: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<CategoryParams>(request);
			const query = getValidatedQuery<Parameters<CategoryService['deleteCategory']>[1]>(request);
			const mode = await dependencies.categoryService.deleteCategory(params.categoryId, query);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff deleted a product category.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'product_category',
				entityId: params.categoryId,
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
