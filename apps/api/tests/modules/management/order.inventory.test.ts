import assert from 'node:assert/strict';
import test from 'node:test';

import {
	aggregateSkuQuantities,
	isOrderStatusTransitionAllowed,
	resolveInventoryAdjustment
} from '../../../src/modules/management/order/order.inventory.js';

test('aggregateSkuQuantities combines repeated SKU lines and ignores custom lines', () => {
	assert.deepEqual(
		[
			...aggregateSkuQuantities([
				{ productSkuId: 'sku-1', quantity: 2 },
				{ productSkuId: null, quantity: 20 },
				{ productSkuId: 'sku-1', quantity: 3 },
				{ productSkuId: 'sku-2', quantity: 1 }
			])
		],
		[
			['sku-1', 5],
			['sku-2', 1]
		]
	);
});

test('order status transitions follow the strict lifecycle', () => {
	const statuses = [
		'pending',
		'confirmed',
		'processing',
		'completed',
		'cancelled',
		'refunded'
	] as const;
	const allowed = new Set([
		'pending:confirmed',
		'pending:cancelled',
		'confirmed:processing',
		'confirmed:cancelled',
		'processing:completed',
		'processing:cancelled',
		'completed:refunded'
	]);

	for (const currentStatus of statuses) {
		for (const nextStatus of statuses) {
			assert.equal(
				isOrderStatusTransitionAllowed(currentStatus, nextStatus),
				currentStatus === nextStatus || allowed.has(`${currentStatus}:${nextStatus}`),
				`${currentStatus} -> ${nextStatus}`
			);
		}
	}
});

test('resolveInventoryAdjustment changes stock only across valid release boundaries', () => {
	assert.equal(resolveInventoryAdjustment('pending', 'cancelled'), 'restore');
	assert.equal(resolveInventoryAdjustment('completed', 'refunded'), 'restore');
	assert.equal(resolveInventoryAdjustment('pending', 'confirmed'), null);
	assert.equal(resolveInventoryAdjustment('completed', 'completed'), null);
});
