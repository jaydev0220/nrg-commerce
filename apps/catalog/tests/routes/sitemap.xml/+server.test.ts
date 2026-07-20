import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/catalog-api.js', () => ({
	fetchCatalogSitemapProducts: vi.fn(async () => [
		{ slug: 'glass beaker', updatedAt: '2026-07-20T00:00:00.000Z' }
	])
}));

import { fetchCatalogSitemapProducts } from '$lib/server/catalog-api.js';
import { GET } from '../../../src/routes/sitemap.xml/+server.js';

describe('catalog sitemap', () => {
	it('emits localized product URLs, alternates, lastmod, and cache policy', async () => {
		const response = await GET({
			fetch,
			url: new URL('https://catalog.example.com/sitemap.xml')
		} as never);
		const xml = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toContain('max-age=300');
		expect(xml).toContain('https://catalog.example.com/glass%20beaker');
		expect(xml).toContain('https://catalog.example.com/en/glass%20beaker');
		expect(xml).toContain('hreflang="x-default"');
		expect(xml).toContain('<lastmod>2026-07-20T00:00:00.000Z</lastmod>');
	});

	it('returns an uncached 503 when no sitemap can be generated', async () => {
		vi.mocked(fetchCatalogSitemapProducts).mockRejectedValueOnce(new Error('unavailable'));
		const response = await GET({
			fetch,
			url: new URL('https://catalog.example.com/sitemap.xml')
		} as never);

		expect(response.status).toBe(503);
		expect(response.headers.get('cache-control')).toBe('no-store');
	});
});
