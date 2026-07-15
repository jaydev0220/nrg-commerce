import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
	loadProductPageData: vi.fn(),
	formatDateTime: vi.fn(() => '2026/7/12 下午3:00')
}));

vi.mock('$lib/api/admin-api', () => api);

const { load } = await import('./+page');

describe('products client page load', () => {
	it('derives table labels from API product data', async () => {
		api.loadProductPageData.mockClear();
		api.loadProductPageData.mockResolvedValueOnce({
			categories: [{ id: 'category-id', name: '散熱器' }],
			products: [
				{
					id: 'product-id',
					categoryId: 'category-id',
					deletedAt: null,
					updatedAt: new Date('2026-07-12T07:00:00Z'),
					skus: [{ price: 1200 }, { price: 1800 }]
				}
			],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
		});

		const result = await load({ url: new URL('http://localhost/products') } as never);
		if (!result) throw new Error('Expected product page data.');

		expect(result['products'][0]).toMatchObject({
			categoryName: '散熱器',
			isDeleted: false,
			skuCount: 2,
			updatedLabel: '2026/7/12 下午3:00'
		});
	});

	it('preserves uncategorized products and forwards archive filters', async () => {
		api.loadProductPageData.mockClear();
		api.loadProductPageData.mockResolvedValueOnce({
			categories: [],
			products: [
				{
					id: 'uncategorized-product-id',
					categoryId: null,
					deletedAt: new Date('2026-07-12T07:00:00Z'),
					updatedAt: new Date('2026-07-12T07:00:00Z'),
					skus: []
				}
			],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
		});

		const result = await load({
			url: new URL('http://localhost/products?archived=true&search=fan')
		} as never);
		const params = api.loadProductPageData.mock.calls[0]?.[0] as URLSearchParams;

		if (!result || !params) throw new Error('Expected product page data and request params.');
		expect(params.get('archived')).toBe('true');
		expect(params.get('search')).toBe('fan');
		expect(params.get('includeDeleted')).toBe('true');
		expect(params.get('includeSkus')).toBe('true');
		expect(result['products'][0]).toMatchObject({
			categoryName: '未分類',
			isDeleted: true,
			skuCount: 0
		});
	});
});
