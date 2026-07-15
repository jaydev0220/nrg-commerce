import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { AppError } from '../../../src/errors/app-error.js';
import { errorHandler } from '../../../src/errors/error-handler.js';
import { createStorefrontCatalogRouter } from '../../../src/modules/storefront/storefront.routes.js';
import type { StorefrontCatalogService } from '../../../src/modules/storefront/storefront.service.js';
import { requestApp } from '../../helpers/http.js';

function createStorefrontService(
	overrides: Partial<StorefrontCatalogService> = {}
): StorefrontCatalogService {
	return {
		listProducts: async () => ({ data: [], total: 0 }),
		getProductById: async () => ({}) as never,
		getProductBySlug: async () => ({}) as never,
		listSkus: async () => ({ data: [], total: 0 }),
		getSkuByCode: async () => ({}) as never,
		listCategories: async () => [],
		getCategoryBySlug: async () => ({}) as never,
		...overrides
	};
}

test('all storefront success responses advertise the shared cache policy', async () => {
	const app = express();
	app.use(
		'/api/storefront/products',
		createStorefrontCatalogRouter({
			storefrontService: createStorefrontService(),
			cacheTtlSeconds: 45
		})
	);
	app.use(errorHandler);

	const responses = await Promise.all([
		requestApp(app, { path: '/api/storefront/products/' }),
		requestApp(app, { path: '/api/storefront/products/skus' }),
		requestApp(app, { path: '/api/storefront/products/skus/SKU-001' }),
		requestApp(app, { path: '/api/storefront/products/categories' }),
		requestApp(app, { path: '/api/storefront/products/categories/bags' }),
		requestApp(app, { path: '/api/storefront/products/energy-shot' })
	]);

	for (const response of responses) {
		assert.equal(response.status, 200, response.text());
		assert.equal(response.headers['cache-control'], 'public, max-age=0, s-maxage=45');
	}
});

test('storefront errors do not advertise a public cache policy', async () => {
	const app = express();
	app.use(
		'/api/storefront/products',
		createStorefrontCatalogRouter({
			storefrontService: createStorefrontService({
				getProductBySlug: async () => {
					throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
				}
			}),
			cacheTtlSeconds: 45
		})
	);
	app.use(errorHandler);

	const response = await requestApp(app, { path: '/api/storefront/products/missing' });
	assert.equal(response.status, 404);
	assert.equal(response.headers['cache-control'], undefined);
});
