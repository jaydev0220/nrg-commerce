import { describe, expect, it } from 'vitest';

import type { ManagedOrder } from '$lib/api/admin-api';
import {
	createCustomDraft,
	createOrderItemDrafts,
	createSkuDraft,
	toOrderUpdateItems,
	validateOrderItemDrafts
} from './order-editor';

const order = {
	id: '00000000-0000-4000-8000-000000000001',
	businessId: null,
	invoiceNumber: null,
	status: 'pending',
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
	version: 4,
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
			productSkuId: '00000000-0000-4000-8000-000000000003',
			skuCode: 'SKU-1',
			productName: 'Catalog item',
			unitPrice: 100,
			quantity: 2,
			lineTotal: 200,
			attributes: { color: 'black' },
			createdAt: new Date('2026-07-01T00:00:00.000Z')
		}
	]
} satisfies ManagedOrder;

describe('order item editor', () => {
	it('preserves existing catalog snapshots in the update contract', () => {
		const drafts = createOrderItemDrafts(order);

		expect(toOrderUpdateItems(drafts)).toEqual([
			{
				id: order.items[0]!.id,
				productSkuId: order.items[0]!.productSkuId,
				quantity: 2,
				expectedSnapshot: {
					skuCode: 'SKU-1',
					productName: 'Catalog item',
					unitPrice: 100,
					attributes: { color: 'black' }
				}
			}
		]);
	});

	it('switches a line between catalog and custom modes without losing its item id', () => {
		const existing = createOrderItemDrafts(order)[0]!;
		const custom = createCustomDraft(existing);
		const catalog = createSkuDraft(
			{
				id: '00000000-0000-4000-8000-000000000004',
				skuCode: 'SKU-2',
				productName: 'Replacement',
				price: 80,
				attributes: {}
			},
			custom
		);

		expect(custom.id).toBe(existing.id);
		expect(custom.productSkuId).toBeUndefined();
		expect(catalog.id).toBe(existing.id);
		expect(catalog.productSkuId).toBe('00000000-0000-4000-8000-000000000004');
		expect(catalog.quantity).toBe(2);
	});

	it('rejects empty, invalid, and duplicate replacement lists', () => {
		expect(validateOrderItemDrafts([])).toBe('訂單至少需要一個品項。');
		const first = createCustomDraft();
		first.skuCode = 'CUSTOM';
		first.productName = 'Custom item';
		const duplicate = { ...first, key: crypto.randomUUID() };
		expect(validateOrderItemDrafts([first, duplicate])).toBe(
			'同一商品或品項編號不可重複加入訂單。'
		);
		first.quantity = 0;
		expect(validateOrderItemDrafts([first])).toBe('品項數量必須至少為 1。');
	});
});
