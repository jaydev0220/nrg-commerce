import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/catalog-api.js', () => ({
	fetchCatalogCategoryBySlug: vi.fn(),
	fetchCatalogIndexData: vi.fn()
}));

import { fetchCatalogCategoryBySlug, fetchCatalogIndexData } from '$lib/server/catalog-api.js';
import { load } from '../../../../src/routes/categories/[slug]/+page.server.js';

const category = {
	id: 'category-id',
	slug: 'glassware',
	name: '玻璃儀器',
	nameEn: 'Glassware',
	description: null,
	descriptionEn: null,
	position: 0,
	parentId: null,
	deletedAt: null,
	productCount: 2,
	createdAt: '2026-07-01T00:00:00.000Z',
	updatedAt: '2026-07-02T00:00:00.000Z',
	children: []
};

const catalogData = {
	products: [],
	categories: [],
	pagination: { page: 1, limit: 18, total: 0, totalPages: 1 }
};

function event(path = '/categories/glassware') {
	return {
		fetch,
		params: { slug: 'glassware' },
		url: new URL(`https://catalog.example.com${path}`)
	} as never;
}

describe('category page server load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(fetchCatalogCategoryBySlug).mockResolvedValue(category);
		vi.mocked(fetchCatalogIndexData).mockResolvedValue(catalogData);
	});

	it('loads a populated category and its first product page', async () => {
		const result = await load(event());
		if (!result || !('category' in result) || !('query' in result)) {
			throw new Error('Expected category page data.');
		}

		expect(result['category']).toEqual(category);
		expect(result['query'].page).toBe(1);
		expect(fetchCatalogCategoryBySlug).toHaveBeenCalledWith(fetch, 'glassware', {
			includeProductCount: true
		});
		expect(fetchCatalogIndexData).toHaveBeenCalledWith(fetch, {
			page: 1,
			limit: 18,
			categorySlug: 'glassware',
			sort: 'createdAt',
			order: 'desc'
		});
	});

	it('returns not found for empty categories', async () => {
		vi.mocked(fetchCatalogCategoryBySlug).mockResolvedValueOnce({ ...category, productCount: 0 });

		await expect(load(event())).rejects.toMatchObject({ status: 404 });
		expect(fetchCatalogIndexData).not.toHaveBeenCalled();
	});

	it('returns not found when the requested category page is out of range', async () => {
		vi.mocked(fetchCatalogIndexData).mockResolvedValueOnce({
			...catalogData,
			pagination: { ...catalogData.pagination, page: 2, totalPages: 1 }
		});

		await expect(load(event('/categories/glassware?page=2'))).rejects.toMatchObject({
			status: 404
		});
	});
});
