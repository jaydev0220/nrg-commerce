import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_API_BASE_URL: 'https://api.example.test/'
	}
}));

import {
	fetchCatalogCategoryBySlug,
	fetchCatalogIndexData,
	fetchCatalogProductBySlug,
	fetchCatalogSitemapCategories,
	fetchCatalogSitemapProducts,
	fetchCatalogSitemapSkus
} from '$lib/server/catalog-api.js';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json'
		}
	});
}

const productId = '00000000-0000-4000-8000-000000000001';
const timestamp = '2026-07-01T00:00:00.000Z';

function productRecord(overrides: Record<string, unknown> = {}) {
	return {
		id: productId,
		slug: 'glassware',
		name: 'Glassware',
		nameEn: null,
		description: null,
		descriptionEn: null,
		categoryId: null,
		categorySlug: null,
		published: true,
		deletedAt: null,
		createdAt: timestamp,
		updatedAt: timestamp,
		thumbnail: null,
		images: [],
		skus: [],
		...overrides
	};
}

function skuRecord(overrides: Record<string, unknown> = {}) {
	return {
		id: '00000000-0000-4000-8000-000000000101',
		productId,
		productSlug: 'glassware',
		skuCode: 'GLASS-100',
		name: 'Glassware 100',
		nameEn: null,
		description: null,
		descriptionEn: null,
		categoryId: null,
		categorySlug: null,
		price: 100,
		availability: 'in_stock',
		published: true,
		attributes: { volume: '100 ml' },
		deletedAt: null,
		createdAt: timestamp,
		updatedAt: timestamp,
		images: [],
		...overrides
	};
}

describe('catalog API client', () => {
	it('requests paginated products and the category tree with the storefront contract', async () => {
		const fetcher = vi.fn<typeof fetch>(async (input) => {
			const url = new URL(String(input));
			if (url.pathname.endsWith('/categories')) {
				return jsonResponse({ data: [] });
			}

			return jsonResponse({
				data: [],
				pagination: { page: 2, limit: 18, total: 20, totalPages: 2 }
			});
		});

		const result = await fetchCatalogIndexData(fetcher, {
			page: 2,
			limit: 18,
			search: 'SKU-001',
			categorySlug: 'glassware',
			sort: 'minPrice',
			order: 'asc'
		});

		const productRequest = new URL(String(fetcher.mock.calls[0]?.[0]));
		const categoryRequest = new URL(String(fetcher.mock.calls[1]?.[0]));
		expect(productRequest.pathname).toBe('/api/storefront/products');
		expect(productRequest.searchParams.get('page')).toBe('2');
		expect(productRequest.searchParams.get('limit')).toBe('18');
		expect(productRequest.searchParams.get('search')).toBe('SKU-001');
		expect(productRequest.searchParams.get('categorySlug')).toBe('glassware');
		expect(productRequest.searchParams.get('sort')).toBe('minPrice');
		expect(productRequest.searchParams.get('order')).toBe('asc');
		expect(categoryRequest.searchParams.get('includeTree')).toBe('true');
		expect(categoryRequest.searchParams.get('includeProductCount')).toBe('true');
		expect(result.pagination.totalPages).toBe(2);
	});

	it('maps upstream not-found responses to a catalog not-found error', async () => {
		await expect(
			fetchCatalogProductBySlug(async () => jsonResponse({}, 404), 'missing product')
		).rejects.toMatchObject({ status: 404 });
	});

	it('maps network failures to a catalog service error', async () => {
		await expect(
			fetchCatalogCategoryBySlug(async () => {
				throw new TypeError('network unavailable');
			}, 'glassware')
		).rejects.toMatchObject({ status: 502 });
	});

	it('rejects malformed successful responses at the API boundary', async () => {
		await expect(
			fetchCatalogProductBySlug(async () => jsonResponse({ slug: 'incomplete' }), 'glassware')
		).rejects.toMatchObject({
			status: 502,
			body: { message: 'The catalog service returned an invalid response.' }
		});
	});

	it('aborts slow requests after the configured timeout', async () => {
		vi.useFakeTimers();
		try {
			const fetcher = vi.fn<typeof fetch>(
				async (_input, init) =>
					new Promise((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () =>
							reject(new DOMException('The request timed out.', 'AbortError'))
						);
					})
			);
			const request = fetchCatalogCategoryBySlug(fetcher, 'glassware');
			const assertion = expect(request).rejects.toMatchObject({ status: 502 });

			await vi.advanceTimersByTimeAsync(5_000);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it('encodes product slugs in detail requests', async () => {
		const fetcher = vi.fn<typeof fetch>(async () => jsonResponse(productRecord()));
		await fetchCatalogProductBySlug(fetcher, 'glassware / large');

		const requestUrl = String(fetcher.mock.calls[0]?.[0]);
		expect(requestUrl).toContain('/api/storefront/products/glassware%20%2F%20large');
		expect(requestUrl).toContain('includeSkus=true');
		expect(requestUrl).toContain('includeImages=true');
	});

	it('loads every storefront product page for sitemap generation', async () => {
		const fetcher = vi.fn<typeof fetch>(async (input) => {
			const page = Number(new URL(String(input)).searchParams.get('page'));
			const updatedAt = `2026-07-${String(page).padStart(2, '0')}T00:00:00.000Z`;
			return jsonResponse({
				data: [productRecord({ slug: `product-${page}`, updatedAt })],
				pagination: { page, limit: 100, total: 2, totalPages: 2 }
			});
		});

		await expect(fetchCatalogSitemapProducts(fetcher)).resolves.toEqual([
			{ slug: 'product-1', updatedAt: '2026-07-01T00:00:00.000Z' },
			{ slug: 'product-2', updatedAt: '2026-07-02T00:00:00.000Z' }
		]);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(new URL(String(fetcher.mock.calls[0]?.[0])).searchParams.get('limit')).toBe('100');
	});

	it('loads every storefront SKU page for variant sitemap generation', async () => {
		const fetcher = vi.fn<typeof fetch>(async (input) => {
			const page = Number(new URL(String(input)).searchParams.get('page'));
			const updatedAt = `2026-07-${String(page).padStart(2, '0')}T00:00:00.000Z`;
			return jsonResponse({
				data: [skuRecord({ productSlug: `product-${page}`, skuCode: `SKU-${page}`, updatedAt })],
				pagination: { page, limit: 100, total: 2, totalPages: 2 }
			});
		});

		await expect(fetchCatalogSitemapSkus(fetcher)).resolves.toEqual([
			{ productSlug: 'product-1', skuCode: 'SKU-1', updatedAt: '2026-07-01T00:00:00.000Z' },
			{ productSlug: 'product-2', skuCode: 'SKU-2', updatedAt: '2026-07-02T00:00:00.000Z' }
		]);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(new URL(String(fetcher.mock.calls[0]?.[0])).pathname).toBe(
			'/api/storefront/products/skus'
		);
	});

	it('flattens the category tree and excludes empty categories from sitemap data', async () => {
		const fetcher = vi.fn<typeof fetch>(async () =>
			jsonResponse({
				data: [
					{
						id: '00000000-0000-4000-8000-000000000010',
						slug: 'glassware',
						name: 'Glassware',
						nameEn: null,
						description: null,
						descriptionEn: null,
						position: 0,
						deletedAt: null,
						parentId: null,
						productCount: 2,
						createdAt: timestamp,
						updatedAt: timestamp,
						children: [
							{
								id: '00000000-0000-4000-8000-000000000011',
								slug: 'empty',
								name: 'Empty',
								nameEn: null,
								description: null,
								descriptionEn: null,
								position: 0,
								deletedAt: null,
								parentId: '00000000-0000-4000-8000-000000000010',
								productCount: 0,
								createdAt: timestamp,
								updatedAt: timestamp,
								children: []
							}
						]
					}
				]
			})
		);

		await expect(fetchCatalogSitemapCategories(fetcher)).resolves.toEqual([
			{ slug: 'glassware', updatedAt: timestamp, productCount: 2 }
		]);
	});
});
