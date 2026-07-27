import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createCachedStorefrontCatalogService } from '../../../src/modules/storefront/storefront.cached-service.js';
import type { StorefrontCatalogService } from '../../../src/modules/storefront/storefront.service.js';

function createService(overrides: Partial<Record<keyof StorefrontCatalogService, unknown>> = {}) {
	let calls = 0;
	const service = {
		listProducts: async () => {
			calls += 1;
			return { data: [], total: 0 };
		},
		getProductById: async () => {
			calls += 1;
			return {};
		},
		getProductBySlug: async () => {
			calls += 1;
			return {};
		},
		listSkus: async () => {
			calls += 1;
			return { data: [], total: 0 };
		},
		getSkuByCode: async () => {
			calls += 1;
			return {};
		},
		listCategories: async () => {
			calls += 1;
			return [];
		},
		getCategoryBySlug: async () => {
			calls += 1;
			return {};
		},
		...overrides
	} as unknown as StorefrontCatalogService;

	return { service, getCalls: () => calls };
}

test('cached storefront service caches every catalog operation by its input', async () => {
	const { service, getCalls } = createService();
	const cached = createCachedStorefrontCatalogService(service, {
		ttlMs: 1_000,
		maxEntries: 20,
		maxPending: 10
	});

	await cached.listProducts({
		page: 1,
		limit: 20,
		includeSkus: false,
		includeImages: false,
		sort: 'createdAt',
		order: 'desc'
	});
	await cached.listProducts({
		page: 1,
		limit: 20,
		includeSkus: false,
		includeImages: false,
		sort: 'createdAt',
		order: 'desc'
	});
	assert.equal(getCalls(), 1);

	await cached.listSkus({
		page: 1,
		limit: 20,
		includeImages: false,
		sort: 'createdAt',
		order: 'desc'
	});
	assert.equal(getCalls(), 2);
});

test('cached storefront service does not retain failed requests', async () => {
	let shouldFail = true;
	let calls = 0;
	const { service } = createService({
		getProductBySlug: async () => {
			calls += 1;
			if (shouldFail) {
				shouldFail = false;
				throw new Error('not found');
			}
			return {};
		}
	});
	const cached = createCachedStorefrontCatalogService(service, {
		ttlMs: 1_000,
		maxEntries: 20,
		maxPending: 10
	});
	const query = { includeSkus: false, includeImages: false };

	await assert.rejects(() => cached.getProductBySlug('product', query));
	await cached.getProductBySlug('product', query);
	assert.equal(calls, 2);
});

test('cached storefront service returns a controlled overload error at load capacity', async () => {
	let release: (() => void) | undefined;
	const { service } = createService({
		listProducts: async () =>
			new Promise<{ data: []; total: number }>((resolve) => {
				release = () => resolve({ data: [], total: 0 });
			})
	});
	const cached = createCachedStorefrontCatalogService(service, {
		ttlMs: 1_000,
		maxEntries: 20,
		maxPending: 1
	});
	const first = cached.listProducts({
		page: 1,
		limit: 20,
		includeSkus: false,
		includeImages: false,
		sort: 'createdAt',
		order: 'desc'
	});

	await assert.rejects(
		() =>
			cached.listSkus({
				page: 1,
				limit: 20,
				includeImages: false,
				sort: 'createdAt',
				order: 'desc'
			}),
		(error: unknown) => {
			assert.ok(error instanceof AppError);
			assert.equal(error.statusCode, 503);
			assert.equal(error.code, 'STOREFRONT_BUSY');
			return true;
		}
	);
	await Promise.resolve();
	release?.();
	await first;
});
