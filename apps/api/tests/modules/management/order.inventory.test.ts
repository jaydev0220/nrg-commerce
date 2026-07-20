import assert from 'node:assert/strict';
import test from 'node:test';

import {
	aggregateSkuQuantities,
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

test('resolveInventoryAdjustment releases and re-deducts stock exactly at status boundaries', () => {
	assert.equal(resolveInventoryAdjustment('pending', 'cancelled'), 'restore');
	assert.equal(resolveInventoryAdjustment('completed', 'refunded'), 'restore');
	assert.equal(resolveInventoryAdjustment('cancelled', 'pending'), 'deduct');
	assert.equal(resolveInventoryAdjustment('refunded', 'completed'), 'deduct');
	assert.equal(resolveInventoryAdjustment('cancelled', 'refunded'), null);
	assert.equal(resolveInventoryAdjustment('pending', 'completed'), null);
});
