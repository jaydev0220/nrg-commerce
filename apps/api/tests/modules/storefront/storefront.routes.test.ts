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
		getProductById: async () => ({ skus: [] }) as never,
		getProductBySlug: async () => ({ skus: [] }) as never,
		listSkus: async () => ({ data: [], total: 0 }),
		getSkuByCode: async () => ({ stockQuantity: 5 }) as never,
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
	assert.equal('stockQuantity' in responses[2]!.json<Record<string, unknown>>(), false);
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

test('product list accepts minimum-price sorting and forwards pagination queries', async () => {
	let receivedQuery: Record<string, unknown> | undefined;
	const app = express();
	app.use(
		'/api/storefront/products',
		createStorefrontCatalogRouter({
			storefrontService: createStorefrontService({
				listProducts: async (query) => {
					receivedQuery = query;
					return { data: [], total: 0 };
				}
			})
		})
	);
	app.use(errorHandler);

	const response = await requestApp(app, {
		path: '/api/storefront/products/?page=2&limit=18&sort=minPrice&order=asc&includeSkus=true'
	});

	assert.equal(response.status, 200, response.text());
	assert.deepEqual(receivedQuery, {
		page: 2,
		limit: 18,
		includeSkus: true,
		includeImages: false,
		sort: 'minPrice',
		order: 'asc'
	});
});

test('storefront resource routes reject oversized identifiers before repository access', async () => {
	let repositoryCalled = false;
	const app = express();
	app.use(
		'/api/storefront/products',
		createStorefrontCatalogRouter({
			storefrontService: createStorefrontService({
				getProductBySlug: async () => {
					repositoryCalled = true;
					return { skus: [] } as never;
				}
			})
		})
	);
	app.use(errorHandler);

	const response = await requestApp(app, {
		path: `/api/storefront/products/${'a'.repeat(161)}`
	});

	assert.equal(response.status, 422, response.text());
	assert.equal(repositoryCalled, false);
});
