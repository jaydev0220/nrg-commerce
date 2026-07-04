import type { RequestHandler } from 'express';

import {
	getValidatedBody,
	getValidatedParams,
	getValidatedQuery
} from '../../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../../utils/pagination.js';
import type { ProductService } from './product.service.js';

type ProductManagementControllerDependencies = {
	productService: ProductService;
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
			const body = getValidatedBody<Parameters<ProductService['createProduct']>[0]>(request);
			const product = await dependencies.productService.createProduct(body);
			response.status(201).location(`/api/management/products/${product.id}`).json(product);
		},

		getProduct: async (request, response) => {
			const params = getValidatedParams<ProductParams>(request);
			const query = getValidatedQuery<Parameters<ProductService['getProduct']>[1]>(request);
			const product = await dependencies.productService.getProduct(params.productId, query);
			response.status(200).json(product);
		},

		updateProduct: async (request, response) => {
			const params = getValidatedParams<ProductParams>(request);
			const body = getValidatedBody<Parameters<ProductService['updateProduct']>[1]>(request);
			const product = await dependencies.productService.updateProduct(params.productId, body);
			response.status(200).json(product);
		},

		deleteProduct: async (request, response) => {
			const params = getValidatedParams<ProductParams>(request);
			const query = getValidatedQuery<Parameters<ProductService['deleteProduct']>[1]>(request);
			const mode = await dependencies.productService.deleteProduct(params.productId, query);
			response.status(200).json({
				deleted: true,
				mode
			});
		}
	};

	return controller;
}
