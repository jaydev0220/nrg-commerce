import type { RequestHandler } from 'express';

import {
	getValidatedBody,
	getValidatedParams,
	getValidatedQuery
} from '../../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../../utils/pagination.js';
import type { CategoryService } from './category.service.js';

type CategoryManagementControllerDependencies = {
	categoryService: CategoryService;
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
			const body = getValidatedBody<Parameters<CategoryService['createCategory']>[0]>(request);
			const category = await dependencies.categoryService.createCategory(body);
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
			const params = getValidatedParams<CategoryParams>(request);
			const body = getValidatedBody<Parameters<CategoryService['updateCategory']>[1]>(request);
			const category = await dependencies.categoryService.updateCategory(params.categoryId, body);
			response.status(200).json(category);
		},

		deleteCategory: async (request, response) => {
			const params = getValidatedParams<CategoryParams>(request);
			const query = getValidatedQuery<Parameters<CategoryService['deleteCategory']>[1]>(request);
			const mode = await dependencies.categoryService.deleteCategory(params.categoryId, query);
			response.status(200).json({
				deleted: true,
				mode
			});
		}
	};

	return controller;
}
