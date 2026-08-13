import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_CDN_BASE_URL: 'https://cdn.example.test',
	PUBLIC_CTA_URL: 'https://catalog.example.test',
	PUBLIC_FACEBOOK_URL: 'https://facebook.example.test/nrg',
	PUBLIC_LINE_URL: 'https://line.example.test/nrg'
}));
vi.mock('$app/state', () => ({ page: { url: new URL('https://www.example.test/en/') } }));

import ProductGrid from '$lib/components/landing/ProductGrid.svelte';

test('renders one optimized image and localized catalog link per product category', async () => {
	const screen = await render(ProductGrid);
	const images = screen.container.querySelectorAll<HTMLImageElement>('img');
	const links = screen.container.querySelectorAll<HTMLAnchorElement>('.product-card');

	expect(images).toHaveLength(5);
	expect(links).toHaveLength(5);
	expect(Array.from(links, (link) => link.href)).toEqual([
		'https://catalog.example.test/en/categories/beakers',
		'https://catalog.example.test/en/categories/test-tubes',
		'https://catalog.example.test/en/categories/funnels',
		'https://catalog.example.test/en/categories/condensers',
		'https://catalog.example.test/en/categories/hydrometers'
	]);
	for (const image of images) {
		expect(image.alt).toBeTruthy();
		expect(image.getAttribute('width')).toBe('1200');
		expect(image.getAttribute('height')).toBe('800');
		expect(image.loading).toBe('lazy');
		expect(image.decoding).toBe('async');
	}
});
