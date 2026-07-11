import assert from 'node:assert/strict';
import test from 'node:test';

import type { ManagedOrderRecord } from '../../../src/types/management.js';
import { AppError } from '../../../src/errors/app-error.js';
import { createOrderService } from '../../../src/modules/management/order/order.service.js';

test('createOrder computes item count and total amount from line-item snapshots', async () => {
	let persistedOrderInput:
		| Parameters<Parameters<typeof createOrderService>[0]['repository']['createOrder']>[0]
		| undefined;

	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => null,
			findBusinessById: async () => null,
			findSkuById: async () => null,
			createOrder: async (input) => {
				persistedOrderInput = input;
				return {
					id: 'order-1',
					businessId: null,
					status: 'pending',
					customerName: input.customerName ?? null,
					customerEmail: input.customerEmail ?? null,
					customerPhone: input.customerPhone ?? null,
					customerAddress: input.customerAddress ?? null,
					itemCount: input.itemCount,
					totalAmount: input.totalAmount,
					createdAt: new Date('2026-07-08T08:00:00.000Z'),
					updatedAt: new Date('2026-07-08T08:00:00.000Z'),
					business: null,
					items: input.items.map((item, index) => ({
						id: `item-${index + 1}`,
						orderId: 'order-1',
						productSkuId: item.productSkuId ?? null,
						skuCode: item.skuCode,
						productName: item.productName,
						unitPrice: item.unitPrice,
						quantity: item.quantity,
						lineTotal: item.lineTotal,
						attributes: item.attributes as Record<string, string>,
						createdAt: new Date('2026-07-08T08:00:00.000Z')
					}))
				} as ManagedOrderRecord;
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			}
		}
	});

	const createdOrderInput = {
		customerName: 'Walk-in Buyer',
		items: [
			{
				skuCode: 'CUSTOM-001',
				productName: 'Custom Item',
				unitPrice: 9.99,
				quantity: 3,
				attributes: {}
			}
		]
	};

	const order = await orderService.createOrder(createdOrderInput);

	assert.equal(persistedOrderInput?.itemCount, 3);
	assert.equal(persistedOrderInput?.totalAmount, 29.97);
	assert.equal(persistedOrderInput?.items[0]?.lineTotal, 29.97);
	assert.equal(order.totalAmount, 29.97);
});

test('createOrder rejects missing referenced businesses', async () => {
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => null,
			findBusinessById: async () => null,
			findSkuById: async () => null,
			createOrder: async () => {
				throw new Error('not used');
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			}
		}
	});

	await assert.rejects(
		() =>
			orderService.createOrder({
				businessId: 'business-1',
				items: [
					{
						skuCode: 'CUSTOM-001',
						productName: 'Custom Item',
						unitPrice: 9.99,
						quantity: 1,
						attributes: {}
					}
				]
			}),
		(error: unknown) => error instanceof AppError && error.code === 'BUSINESS_NOT_FOUND'
	);
});

test('createOrder rejects missing referenced product skus', async () => {
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => null,
			findBusinessById: async () => null,
			findSkuById: async () => null,
			createOrder: async () => {
				throw new Error('not used');
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			}
		}
	});

	await assert.rejects(
		() =>
			orderService.createOrder({
				items: [
					{
						productSkuId: 'sku-1',
						skuCode: 'SKU-1',
						productName: 'Catalog Item',
						unitPrice: 9.99,
						quantity: 1,
						attributes: {}
					}
				]
			}),
		(error: unknown) => error instanceof AppError && error.code === 'PRODUCT_SKU_NOT_FOUND'
	);
});
