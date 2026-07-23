import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
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
					subtotalAmount: input.subtotalAmount,
					discountLabelId: input.discountLabelId,
					discountLabelName: input.discountLabelName,
					suggestedDiscountRate: input.suggestedDiscountRate,
					discountRate: input.discountRate,
					discountAmount: input.discountAmount,
					totalAmount: input.totalAmount,
					completedAt: null,
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
			},
			updateOrder: async () => {
				throw new Error('not used');
			}
		}
	});

	const createdOrderInput = {
		customerName: 'Walk-in Buyer',
		customerPhone: '0912345678',
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
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async () => {
				throw new Error('not used');
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			},
			updateOrder: async () => {
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

test('createOrder snapshots a business label discount and preserves an explicit override', async () => {
	let persistedOrderInput:
		| Parameters<Parameters<typeof createOrderService>[0]['repository']['createOrder']>[0]
		| undefined;
	const business = {
		id: 'business-1',
		name: 'Northwind',
		contactName: null,
		contactEmail: null,
		contactPhone: null,
		taxId: null,
		address: null,
		notes: null,
		labelId: 'label-1',
		label: {
			id: 'label-1',
			name: 'Preferred',
			color: '#2F6FED',
			discountRate: 10,
			deletedAt: null,
			createdAt: new Date(),
			updatedAt: new Date()
		},
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date()
	};
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => null,
			findBusinessById: async () => business,
			findSkuById: async () => null,
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async (input) => {
				persistedOrderInput = input;
				return {} as ManagedOrderRecord;
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			},
			updateOrder: async () => {
				throw new Error('not used');
			}
		}
	});

	await orderService.createOrder({
		businessId: 'business-1',
		discountRate: 25,
		items: [
			{
				skuCode: 'SKU-1',
				productName: 'Item',
				unitPrice: 100,
				quantity: 2,
				attributes: {}
			}
		]
	});

	assert.equal(persistedOrderInput?.subtotalAmount, 200);
	assert.equal(persistedOrderInput?.discountLabelId, 'label-1');
	assert.equal(persistedOrderInput?.discountLabelName, 'Preferred');
	assert.equal(persistedOrderInput?.suggestedDiscountRate, 10);
	assert.equal(persistedOrderInput?.discountRate, 25);
	assert.equal(persistedOrderInput?.discountAmount, 50);
	assert.equal(persistedOrderInput?.totalAmount, 150);
});

test('createOrder stores the label rate when no custom discount is provided', async () => {
	let discountRate = 0;
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => null,
			findBusinessById: async () => ({
				id: 'business-1',
				name: 'Northwind',
				contactName: null,
				contactEmail: null,
				contactPhone: null,
				taxId: null,
				address: null,
				notes: null,
				labelId: 'label-1',
				label: {
					id: 'label-1',
					name: 'Preferred',
					color: '#2F6FED',
					discountRate: 12.5,
					deletedAt: null,
					createdAt: new Date(),
					updatedAt: new Date()
				},
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date()
			}),
			findSkuById: async () => null,
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async (input) => {
				discountRate = input.discountRate;
				return {} as ManagedOrderRecord;
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			},
			updateOrder: async () => {
				throw new Error('not used');
			}
		}
	});

	await orderService.createOrder({
		businessId: 'business-1',
		items: [
			{
				skuCode: 'SKU-1',
				productName: 'Item',
				unitPrice: 80,
				quantity: 1,
				attributes: {}
			}
		]
	});

	assert.equal(discountRate, 12.5);
});

test('createOrder rejects missing referenced product skus', async () => {
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => null,
			findBusinessById: async () => null,
			findSkuById: async () => null,
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async () => {
				throw new Error('not used');
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			},
			updateOrder: async () => {
				throw new Error('not used');
			}
		}
	});

	await assert.rejects(
		() =>
			orderService.createOrder({
				customerName: 'Walk-in Buyer',
				customerPhone: '0912345678',
				items: [
					{
						productSkuId: 'sku-1',
						quantity: 1
					}
				]
			}),
		(error: unknown) => error instanceof AppError && error.code === 'PRODUCT_SKU_NOT_FOUND'
	);
});

test('createOrder persists the server-side catalog snapshot for referenced product skus', async () => {
	let persistedItem:
		| Parameters<
				Parameters<typeof createOrderService>[0]['repository']['createOrder']
		  >[0]['items'][0]
		| undefined;
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => null,
			findBusinessById: async () => null,
			findSkuById: async () => ({
				id: 'sku-1',
				skuCode: 'REAL-SKU',
				productName: 'Catalog Item',
				price: 49.95,
				attributes: { color: 'black' }
			}),
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async (input) => {
				persistedItem = input.items[0];
				return {} as ManagedOrderRecord;
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			},
			updateOrder: async () => {
				throw new Error('not used');
			}
		}
	});

	await orderService.createOrder({
		customerName: 'Walk-in Buyer',
		customerPhone: '0912345678',
		items: [
			{
				productSkuId: 'sku-1',
				skuCode: 'SPOOFED',
				productName: 'Spoofed item',
				unitPrice: 0.01,
				quantity: 2,
				attributes: { spoofed: true }
			} as never
		]
	});

	assert.deepEqual(persistedItem, {
		productSkuId: 'sku-1',
		skuCode: 'REAL-SKU',
		productName: 'Catalog Item',
		unitPrice: 49.95,
		quantity: 2,
		attributes: { color: 'black' },
		lineTotal: 99.9
	});
});

test('updateOrder changes customer fields without replacing item snapshots', async () => {
	let updateInput: Record<string, unknown> | undefined;
	const existing = {
		id: 'order-1',
		businessId: null,
		status: 'pending' as const,
		customerName: 'Old',
		customerEmail: null,
		customerPhone: '0912345678',
		customerAddress: null,
		itemCount: 1,
		subtotalAmount: 99,
		discountLabelId: null,
		discountLabelName: null,
		suggestedDiscountRate: null,
		discountRate: 0,
		discountAmount: 0,
		totalAmount: 99,
		version: 0,
		completedAt: null,
		cancelledAt: null,
		refundedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		business: null,
		items: [
			{
				id: 'item-1',
				orderId: 'order-1',
				productSkuId: null,
				skuCode: 'SKU',
				productName: 'Item',
				unitPrice: 99,
				quantity: 1,
				lineTotal: 99,
				attributes: {},
				createdAt: new Date()
			}
		]
	};
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => existing,
			findBusinessById: async () => null,
			findSkuById: async () => null,
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async () => {
				throw new Error('not used');
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			},
			updateOrder: async (_id, input) => {
				updateInput = input;
				return {
					order: { ...existing, ...input },
					previousStatus: existing.status
				};
			}
		}
	});

	const result = await orderService.updateOrder('order-1', {
		customerName: 'New',
		status: 'confirmed'
	});
	assert.deepEqual(updateInput, {
		customerName: 'New',
		status: 'confirmed'
	});
	assert.deepEqual(result.order.items, existing.items);
});

test('updateOrder rejects removing a business without consumer contact', async () => {
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () =>
				({
					businessId: 'business-1',
					customerName: null,
					customerPhone: null
				}) as ManagedOrderRecord,
			findBusinessById: async () => null,
			findSkuById: async () => null,
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async () => {
				throw new Error('not used');
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			},
			updateOrder: async () => {
				throw new Error('not used');
			}
		}
	});

	await assert.rejects(
		() => orderService.updateOrder('order-1', { businessId: null }),
		(error: unknown) => error instanceof AppError && error.code === 'CUSTOMER_CONTACT_REQUIRED'
	);
});

test('createOrder reuses an idempotency key and rejects conflicting payloads', async () => {
	let persisted: { order: ManagedOrderRecord; fingerprint: string } | null = null;
	let createCalls = 0;
	const persistedOrder = { id: 'order-1', totalAmount: 10 } as ManagedOrderRecord;
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => null,
			findOrderByIdempotencyKey: async () => persisted,
			findBusinessById: async () => null,
			findSkuById: async () => null,
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async (input) => {
				createCalls += 1;
				persisted = { order: persistedOrder, fingerprint: input.idempotencyFingerprint };
				return persistedOrder;
			},
			updateOrderStatus: async () => {
				throw new Error('not used');
			},
			updateOrder: async () => {
				throw new Error('not used');
			}
		}
	});
	const idempotencyKey = randomUUID();
	const input = {
		idempotencyKey,
		customerName: 'Walk-in Buyer',
		customerPhone: '0912345678',
		items: [
			{
				skuCode: 'CUSTOM-001',
				productName: 'Custom Item',
				unitPrice: 10,
				quantity: 1,
				attributes: {}
			}
		]
	};

	const first = await orderService.createOrder(input);
	const second = await orderService.createOrder(input);

	assert.equal(first.reused, false);
	assert.equal(second.reused, true);
	assert.equal(createCalls, 1);

	await assert.rejects(
		() =>
			orderService.createOrder({
				...input,
				items: [
					{
						skuCode: input.items[0]!.skuCode,
						productName: input.items[0]!.productName,
						unitPrice: input.items[0]!.unitPrice,
						quantity: 2,
						attributes: input.items[0]!.attributes
					}
				]
			}),
		(error: unknown) => error instanceof AppError && error.code === 'IDEMPOTENCY_KEY_REUSED'
	);
});

test('updateOrderStatus returns the atomic repository transition result', async () => {
	const order = {
		id: 'order-1',
		status: 'completed'
	} as ManagedOrderRecord;
	const orderService = createOrderService({
		repository: {
			listOrders: async () => ({ data: [], total: 0 }),
			findOrderById: async () => {
				throw new Error('updateOrderStatus must not perform a preflight read');
			},
			findBusinessById: async () => null,
			findSkuById: async () => null,
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async () => {
				throw new Error('not used');
			},
			updateOrderStatus: async (orderId, status) => {
				assert.equal(orderId, 'order-1');
				assert.equal(status, 'completed');
				return { order, previousStatus: 'processing' };
			},
			updateOrder: async () => {
				throw new Error('not used');
			}
		}
	});

	const result = await orderService.updateOrderStatus('order-1', 'completed');

	assert.deepEqual(result, { order, previousStatus: 'processing' });
});
