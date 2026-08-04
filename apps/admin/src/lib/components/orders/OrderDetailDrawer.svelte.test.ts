import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';

import type { ManagedOrder, ManagedOrderUpdatePreview } from '$lib/api/admin-api';
import OrderDetailDrawer from './OrderDetailDrawer.svelte';

const order = {
	id: '00000000-0000-4000-8000-000000000001',
	businessId: null,
	invoiceNumber: null,
	status: 'pending',
	customerName: 'Consumer',
	customerEmail: null,
	customerPhone: '0912345678',
	customerAddress: null,
	itemCount: 1,
	subtotalAmount: 100,
	discountLabelId: null,
	discountLabelName: null,
	suggestedDiscountRate: null,
	discountRate: 0,
	discountAmount: 0,
	totalAmount: 100,
	version: 3,
	completedAt: null,
	cancelledAt: null,
	refundedAt: null,
	createdAt: new Date('2026-07-01T00:00:00.000Z'),
	updatedAt: new Date('2026-07-01T00:00:00.000Z'),
	business: null,
	items: [
		{
			id: '00000000-0000-4000-8000-000000000002',
			orderId: '00000000-0000-4000-8000-000000000001',
			productSkuId: null,
			skuCode: 'CUSTOM-1',
			productName: 'Custom item',
			unitPrice: 100,
			quantity: 1,
			lineTotal: 100,
			attributes: {},
			createdAt: new Date('2026-07-01T00:00:00.000Z')
		}
	]
} satisfies ManagedOrder;

function createPreview(): ManagedOrderUpdatePreview {
	const before = {
		id: order.items[0]!.id,
		productSkuId: null,
		skuCode: 'CUSTOM-1',
		productName: 'Custom item',
		unitPrice: 100,
		quantity: 1,
		lineTotal: 100,
		attributes: {}
	};
	const after = { ...before, quantity: 2, lineTotal: 200 };
	return {
		current: order,
		proposed: {
			version: 4,
			status: 'pending',
			businessId: null,
			invoiceNumber: null,
			customerName: 'Consumer',
			customerEmail: null,
			customerPhone: '0912345678',
			customerAddress: null,
			itemCount: 2,
			subtotalAmount: 200,
			discountLabelId: null,
			discountLabelName: null,
			suggestedDiscountRate: null,
			discountRate: 0,
			discountAmount: 0,
			totalAmount: 200,
			items: [after]
		},
		changes: {
			fields: [],
			items: [{ kind: 'modified', itemId: before.id, before, after }],
			totals: {
				before: { itemCount: 1, subtotalAmount: 100, discountAmount: 0, totalAmount: 100 },
				after: { itemCount: 2, subtotalAmount: 200, discountAmount: 0, totalAmount: 200 }
			},
			inventory: []
		}
	};
}

describe('order detail drawer', () => {
	it('previews a line edit before sending the confirmed versioned update', async () => {
		const onpreview = vi.fn().mockResolvedValue(createPreview());
		const onsave = vi.fn().mockResolvedValue(undefined);
		const screen = await render(OrderDetailDrawer, {
			order,
			statusOptions: [{ value: 'pending', label: '待處理' }],
			onclose: vi.fn(),
			onpreview,
			onsave,
			onreload: vi.fn()
		});

		await screen.getByRole('spinbutton', { name: '數量' }).fill('2');
		await screen.getByRole('button', { name: '檢視變更' }).click();

		expect(onpreview).toHaveBeenCalledWith(
			order.id,
			expect.objectContaining({
				version: 3,
				items: [
					expect.objectContaining({
						id: order.items[0]!.id,
						quantity: 2,
						productName: 'Custom item'
					})
				]
			})
		);
		await expect.element(screen.getByText('請確認以下訂單變更')).toBeVisible();
		await expect.element(screen.getByText('修改品項')).toBeVisible();

		await screen.getByRole('button', { name: '確認並儲存' }).click();
		expect(onsave).toHaveBeenCalledWith(order.id, onpreview.mock.calls[0]?.[1]);
	});
});
