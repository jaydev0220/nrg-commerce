import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
	loadBusinessLookups: vi.fn()
}));

vi.mock('$lib/api/admin-api', () => api);

import BusinessCombobox from './BusinessCombobox.svelte';

describe('business combobox', () => {
	it('loads matching business options and emits the selected record', async () => {
		const business = {
			id: 'business-id',
			name: '北區供應商',
			contactName: '王小明',
			contactEmail: 'contact@example.com',
			contactPhone: '0912345678',
			taxId: null,
			address: null,
			notes: null,
			labelId: null,
			label: null,
			deletedAt: null,
			createdAt: new Date(),
			updatedAt: new Date()
		};
		api.loadBusinessLookups.mockResolvedValueOnce({ data: [business], pagination: {} });
		const onselect = vi.fn();
		const screen = await render(BusinessCombobox, { onselect });

		await screen.getByRole('combobox', { name: '搜尋企業' }).click();
		await expect.element(screen.getByRole('option', { name: /北區供應商/ })).toBeVisible();
		await screen.getByRole('option', { name: /北區供應商/ }).click();

		expect(api.loadBusinessLookups).toHaveBeenCalledWith('');
		expect(onselect).toHaveBeenCalledWith(business);
	});
});
