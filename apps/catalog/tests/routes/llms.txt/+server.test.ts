import { expect, test } from 'vitest';

import { GET } from '../../../src/routes/llms.txt/+server.js';

test('catalog llms.txt identifies the catalog and discovery URLs', async () => {
	const response = await GET({ url: new URL('https://catalog.example.com/llms.txt') } as never);
	const body = await response.text();

	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
	expect(response.headers.get('cache-control')).toContain('max-age=300');
	expect(body).toContain('# NRG Glass Product Catalog');
	expect(body).toContain('https://catalog.example.com/');
	expect(body).toContain('https://catalog.example.com/en/');
	expect(body).toContain('https://catalog.example.com/inquiry');
	expect(body).toContain('https://catalog.example.com/en/inquiry');
	expect(body).toContain('The sitemap is authoritative');
	expect(body).toContain('https://catalog.example.com/sitemap.xml');
});
