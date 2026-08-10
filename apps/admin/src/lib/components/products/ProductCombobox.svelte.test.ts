import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
	loadProductLookups: vi.fn()
}));

vi.mock('$lib/api/admin-api', () => api);

import ProductCombobox from './ProductCombobox.svelte';

const product = {
	id: '00000000-0000-4000-8000-000000000001',
	slug: 'glassware',
	name: '玻璃器皿',
	nameEn: null,
	description: null,
	descriptionEn: null,
	notes: null,
	baseUnit: null,
	categoryId: null,
	categorySlug: null,
	published: true,
	deletedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	thumbnail: null,
	images: [],
	skus: []
};

describe('restore product combobox', () => {
	it('shows the active original and allows it to be changed', async () => {
		const onselect = vi.fn();
		const screen = await render(ProductCombobox, { product, onselect });

		await expect.element(screen.getByText('玻璃器皿')).toBeVisible();
		await screen.getByRole('button', { name: '更換商品' }).click();

		expect(onselect).toHaveBeenCalledWith(null);
	});

	it('searches a bounded server-side option list and emits the destination', async () => {
		api.loadProductLookups.mockResolvedValueOnce({ data: [product], pagination: {} });
		const onselect = vi.fn();
		const screen = await render(ProductCombobox, { onselect });

		await screen.getByRole('combobox', { name: '搜尋所屬商品' }).click();
		await expect.element(screen.getByRole('option', { name: /玻璃器皿/ })).toBeVisible();
		await screen.getByRole('option', { name: /玻璃器皿/ }).click();

		expect(api.loadProductLookups).toHaveBeenCalledWith('');
		expect(onselect).toHaveBeenCalledWith(product);
	});
});
