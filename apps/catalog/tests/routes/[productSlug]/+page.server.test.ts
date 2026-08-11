import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProductFixture } from '../../fixtures/product.js';

vi.mock('$lib/server/catalog-api.js', () => ({
	fetchCatalogCategoryBySlug: vi.fn(async () => ({ slug: 'beakers' })),
	fetchCatalogProductBySlug: vi.fn(async () => createProductFixture())
}));

const { load } = await import('../../../src/routes/[productSlug]/+page.server.js');

describe('product page server loader', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns the exact selected SKU for a valid deep link', async () => {
		const data = await load({
			fetch,
			params: { productSlug: 'laboratory-beaker' },
			url: new URL('https://catalog.example.test/en/laboratory-beaker?sku=BEAKER-250')
		} as never);

		expect(data).toMatchObject({ selectedSkuCode: 'BEAKER-250' });
	});

	it.each(['?sku=UNKNOWN', '?sku=', '?sku=BEAKER-100&sku=BEAKER-250'])(
		'redirects invalid SKU query %s to the clean localized product URL',
		async (search) => {
			await expect(
				load({
					fetch,
					params: { productSlug: 'laboratory-beaker' },
					url: new URL(`https://catalog.example.test/en/laboratory-beaker${search}`)
				} as never)
			).rejects.toMatchObject({ status: 302, location: '/en/laboratory-beaker' });
		}
	);
});
