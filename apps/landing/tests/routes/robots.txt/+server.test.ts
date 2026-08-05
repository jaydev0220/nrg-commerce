import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_SITE_URL: 'https://www.example.test'
}));

import { GET } from '../../../src/routes/robots.txt/+server.js';

test('robots.txt allows crawling and references the canonical sitemap', async () => {
	const response = await GET({ url: new URL('https://fallback.example.test/robots.txt') } as never);

	expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
	expect(response.headers.get('cache-control')).toContain('max-age=3600');
	expect(response).toHaveProperty('status', 200);
});

test('robots.txt uses the configured site origin', async () => {
	const response = await GET({ url: new URL('https://fallback.example.test/robots.txt') } as never);
	const body = await response.text();

	expect(body).toContain('User-agent: *');
	expect(body).toContain('Allow: /');
	expect(body).toContain('Sitemap: https://www.example.test/sitemap.xml');
});
