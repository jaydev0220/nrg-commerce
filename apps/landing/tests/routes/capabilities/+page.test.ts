import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_CDN_BASE_URL: 'https://cdn.example.test'
}));

const { load } = await import('../../../src/routes/capabilities/+page');

test('creates indexable Capabilities WebPage SEO data', async () => {
	const data = await load({} as never);
	if (!data?.seo) throw new Error('Expected Capabilities page SEO data.');

	expect(data.seo.pageType).toBe('WebPage');
	expect(data.seo.title).toBeTruthy();
	expect(data.seo.description).toBeTruthy();
	expect(data.seo.openGraphImage).toBe('https://cdn.example.test/og/landing/branding.webp');
});
