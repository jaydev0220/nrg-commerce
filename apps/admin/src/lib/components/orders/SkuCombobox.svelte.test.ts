import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
	loadOrderSkuLookups: vi.fn()
}));

vi.mock('$lib/api/admin-api', () => api);

import SkuCombobox from './SkuCombobox.svelte';

describe('SKU combobox', () => {
	it('loads active SKU options on focus and emits the selected record', async () => {
		const sku = {
			id: 'sku-id',
			skuCode: 'SKU-001',
			productName: '散熱器',
			price: 1200,
			attributes: {}
		};
		api.loadOrderSkuLookups.mockResolvedValueOnce({ data: [sku], pagination: {} });
		const onselect = vi.fn();
		const screen = await render(SkuCombobox, { onselect });

		await screen.getByRole('combobox', { name: '搜尋商品 SKU' }).click();
		await expect.element(screen.getByRole('option', { name: /SKU-001/ })).toBeVisible();
		await screen.getByRole('option', { name: /SKU-001/ }).click();

		expect(api.loadOrderSkuLookups).toHaveBeenCalledWith('');
		expect(onselect).toHaveBeenCalledWith(sku);
	});
});
