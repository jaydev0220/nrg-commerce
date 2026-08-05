import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_CDN_BASE_URL: 'https://cdn.example.test'
}));

const { load } = await import('../../../../src/routes/categories/[slug]/+page.js');

test('creates localized category SEO data and breadcrumbs', async () => {
	const data = await load({
		data: {
			category: {
				slug: 'glassware',
				name: '玻璃儀器',
				nameEn: 'Glassware',
				description: null,
				descriptionEn: null
			},
			products: [],
			pagination: { page: 1, limit: 18, total: 0, totalPages: 1 }
		},
		url: new URL('https://catalog.example.test/en/categories/glassware')
	} as never);
	if (!data?.seo || !data['seoBreadcrumbItems']) {
		throw new Error('Expected category SEO data.');
	}

	expect(data.seo.pageType).toBe('CollectionPage');
	expect(data.seo.title).toContain('Glassware');
	expect(data.seo.openGraphImage).toBe('https://cdn.example.test/og/catalog/gallery.webp');
	expect(data['seoBreadcrumbItems']).toEqual([
		{ name: expect.any(String), pathname: '/' },
		{ name: 'Glassware', pathname: '/categories/glassware' }
	]);
});
