import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_SITE_URL: 'https://www.example.test'
}));

import { GET } from '../../../src/routes/sitemap.xml/+server.js';

test('sitemap.xml emits all localized landing pages and reciprocal alternates', async () => {
	const response = await GET({
		url: new URL('https://fallback.example.test/sitemap.xml')
	} as never);
	const xml = await response.text();

	expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
	expect(response.headers.get('cache-control')).toContain('max-age=3600');
	expect((xml.match(/<loc>/g) ?? []).length).toBe(10);
	expect(xml).toContain('<loc>https://www.example.test/</loc>');
	expect(xml).toContain('<loc>https://www.example.test/capabilities/</loc>');
	expect(xml).toContain('<loc>https://www.example.test/en/capabilities/</loc>');
	expect(xml).toContain('<loc>https://www.example.test/en/contact/</loc>');
	expect(xml).toContain('<loc>https://www.example.test/privacy/</loc>');
	expect(xml).toContain('<loc>https://www.example.test/en/privacy/</loc>');
	expect(xml).toContain('hreflang="x-default"');
});
