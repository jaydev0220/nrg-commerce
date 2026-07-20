import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

import ProductConfigurator from '$lib/components/ProductConfigurator.svelte';
import type { CatalogSkuRecord, ProductConfigurationModel } from '$lib/catalog/types.js';

const activeSku: CatalogSkuRecord = {
	id: 'sku-1',
	productId: 'product-1',
	productSlug: 'beaker',
	skuCode: 'BEAKER-100',
	name: 'Beaker 100 ml',
	nameEn: 'Beaker 100 ml',
	description: null,
	descriptionEn: null,
	categoryId: 'category-1',
	categorySlug: 'beakers',
	price: 120,
	availability: 'in_stock',
	published: true,
	attributes: { size: '100 ml' },
	deletedAt: null,
	createdAt: '2026-07-19T00:00:00.000Z',
	updatedAt: '2026-07-19T00:00:00.000Z',
	images: []
};

const model: ProductConfigurationModel = {
	activeSku,
	selectedAttributes: { size: '100 ml' },
	selectedAttributeEntries: [{ key: 'size', label: 'Size', value: '100 ml', valueLabel: '100 ml' }],
	attributeKeys: ['size'],
	optionGroups: [
		{
			key: 'size',
			label: 'Size',
			options: [
				{ value: '100 ml', label: '100 ml', available: true, selected: true },
				{ value: '250 ml', label: '250 ml', available: false, selected: false }
			]
		}
	]
};

test('exposes unavailable options and delegates only selectable choices', async () => {
	const onSelectOption = vi.fn();
	const screen = await render(ProductConfigurator, {
		locale: 'en',
		categoryLabel: 'Beakers',
		productName: 'Laboratory Beaker',
		productSkuCount: 2,
		model,
		inquiryHref: '/contact?skuCode=BEAKER-100',
		onSelectOption
	});
	const selected = screen.getByRole('radio', { name: '100 ml' });
	const unavailable = screen.getByRole('radio', { name: '250 ml' });

	await expect.element(selected).toHaveAttribute('aria-checked', 'true');
	await expect.element(unavailable).toBeDisabled();
	await selected.click();
	expect(onSelectOption).toHaveBeenCalledWith('size', '100 ml');
	expect(screen.container.querySelector('a[href*="skuCode=BEAKER-100"]')).not.toBeNull();
});
