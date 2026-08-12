import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_SITE_URL: 'https://www.example.test'
}));

import { GET } from '../../../src/routes/llms.txt/+server.js';

test('llms.txt gives crawlers concise factual site discovery links', async () => {
	const response = await GET({ url: new URL('https://fallback.example.test/llms.txt') } as never);
	const body = await response.text();

	expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
	expect(response.headers.get('cache-control')).toContain('max-age=3600');
	expect(body).toContain('# NRG Glass');
	expect(body).toContain('https://www.example.test/');
	expect(body).toContain('https://www.example.test/about/');
	expect(body).toContain('https://www.example.test/en/about/');
	expect(body).toContain('https://www.example.test/capabilities/');
	expect(body).toContain('https://www.example.test/en/capabilities/');
	expect(body).toContain('https://www.example.test/contact/');
	expect(body).toContain('https://www.example.test/en/contact/');
	expect(body).toContain('https://www.example.test/privacy/');
	expect(body).toContain('https://www.example.test/en/privacy/');
	expect(body).toContain('NEW GLATEC Co., Ltd.');
	expect(body).toContain('legal name: 巧新有限公司');
	expect(body).toContain('300+ SKUs');
	expect(body).toContain('The sitemap is authoritative');
	expect(body).toContain('https://www.example.test/sitemap.xml');
});
