import assert from 'node:assert/strict';
import test from 'node:test';

import type { ManagedOrderRecord } from '../../../src/types/management.js';
import { calculateOrderFinancials } from '../../../src/modules/management/order/order.calculations.js';
import {
	buildOrderUpdatePreview,
	catalogSnapshotsEqual
} from '../../../src/modules/management/order/order.update.js';

function createOrder(status: ManagedOrderRecord['status'] = 'pending'): ManagedOrderRecord {
	return {
		id: 'order-1',
		invoiceNumber: null,
		businessId: null,
		status,
		customerName: 'Buyer',
		customerEmail: null,
		customerPhone: '0912345678',
		customerAddress: null,
		itemCount: 2,
		subtotalAmount: 200,
		discountLabelId: 'label-1',
		discountLabelName: 'Preferred',
		suggestedDiscountRate: 10,
		discountRate: 10,
		discountAmount: 20,
		totalAmount: 180,
		version: 3,
		completedAt: null,
		cancelledAt: null,
		refundedAt: null,
		createdAt: new Date('2026-07-01T00:00:00.000Z'),
		updatedAt: new Date('2026-07-01T00:00:00.000Z'),
		business: null,
		items: [
			{
				id: 'item-1',
				orderId: 'order-1',
				productSkuId: 'sku-1',
				skuCode: 'SKU-1',
				productName: 'Catalog item',
				unitPrice: 100,
				quantity: 2,
				lineTotal: 200,
				attributes: { color: 'black' },
				createdAt: new Date('2026-07-01T00:00:00.000Z')
			}
		]
	};
}

function preview(
	order: ManagedOrderRecord,
	quantity: number,
	status = order.status,
	invoiceNumber = order.invoiceNumber
) {
	return buildOrderUpdatePreview(order, {
		status,
		invoiceNumber,
		businessId: order.businessId,
		customerName: order.customerName,
		customerEmail: order.customerEmail,
		customerPhone: order.customerPhone,
		customerAddress: order.customerAddress,
		items: [
			{
				id: 'item-1',
				productSkuId: 'sku-1',
				skuCode: 'SKU-1',
				productName: 'Catalog item',
				unitPrice: 100,
				quantity,
				attributes: { color: 'black' }
			}
		]
	});
}

test('calculateOrderFinancials uses decimal-safe line and discount rounding', () => {
	const result = calculateOrderFinancials(
		[
			{
				productSkuId: null,
				skuCode: 'CUSTOM',
				productName: 'Custom item',
				unitPrice: 9.99,
				quantity: 3,
				attributes: {}
			}
		],
		12.5
	);

	assert.equal(result.subtotalAmount, 29.97);
	assert.equal(result.discountAmount, 3.75);
	assert.equal(result.totalAmount, 26.22);
});

test('catalogSnapshotsEqual ignores object key order but detects catalog drift', () => {
	const expected = {
		skuCode: 'SKU-1',
		productName: 'Catalog item',
		unitPrice: 100,
		attributes: { color: 'black', size: 'M' }
	};

	assert.equal(
		catalogSnapshotsEqual(expected, {
			...expected,
			attributes: { size: 'M', color: 'black' }
		}),
		true
	);
	assert.equal(catalogSnapshotsEqual(expected, { ...expected, unitPrice: 101 }), false);
});

test('order update preview reports item, total, and active inventory changes', () => {
	const result = preview(createOrder(), 4);

	assert.equal(result.proposed.version, 4);
	assert.equal(result.changes.items[0]?.kind, 'modified');
	assert.deepEqual(result.changes.inventory, [
		{ productSkuId: 'sku-1', skuCode: 'SKU-1', stockDelta: -2 }
	]);
	assert.deepEqual(result.changes.totals.after, {
		itemCount: 4,
		subtotalAmount: 400,
		discountAmount: 40,
		totalAmount: 360
	});
	assert.equal(result.proposed.discountLabelName, 'Preferred');
	assert.equal(result.proposed.discountRate, 10);
});

test('order update preview reports invoice number changes', () => {
	const result = preview(createOrder(), 2, 'pending', 'INV001');

	assert.equal(result.proposed.invoiceNumber, 'INV001');
	assert.deepEqual(result.changes.fields, [
		{ field: 'invoiceNumber', before: null, after: 'INV001' }
	]);
});

test('released orders do not reserve inventory when line quantities change', () => {
	assert.deepEqual(preview(createOrder('cancelled'), 5).changes.inventory, []);
	assert.deepEqual(preview(createOrder('refunded'), 1).changes.inventory, []);
});

test('combined status and item changes calculate the net inventory delta', () => {
	assert.deepEqual(preview(createOrder(), 5, 'cancelled').changes.inventory, [
		{ productSkuId: 'sku-1', skuCode: 'SKU-1', stockDelta: 2 }
	]);
	assert.deepEqual(preview(createOrder('cancelled'), 5, 'pending').changes.inventory, [
		{ productSkuId: 'sku-1', skuCode: 'SKU-1', stockDelta: -5 }
	]);
});
