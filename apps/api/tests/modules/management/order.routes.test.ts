import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import express from 'express';

import { errorHandler } from '../../../src/errors/error-handler.js';
import { createOrderManagementRouter } from '../../../src/modules/management/order/order.routes.js';
import type { OrderService } from '../../../src/modules/management/order/order.service.js';
import type { LogService } from '../../../src/modules/management/log/log.service.js';
import type { AuthenticatedStaffContext } from '../../../src/types/auth.js';
import { requestApp } from '../../helpers/http.js';

const authContext: AuthenticatedStaffContext = {
	staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
	sessionId: '0189076c-4f2a-7fe1-b9fd-2d68df455112',
	roles: ['admin'],
	permissions: ['order.read', 'order.write'],
	mfa: ['authenticator'],
	primaryFactor: 'password',
	staff: {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		email: 'admin@example.com',
		name: 'Admin',
		status: 'active',
		passwordHash: null,
		preferredMfaMethod: 'authenticator',
		lastLoginAt: null,
		failedAuthCount: 0,
		failedAuthWindowStartedAt: null,
		authBlockedUntil: null,
		roles: [],
		totpCredentialCount: 1,
		passkeyCredentialCount: 0
	}
};

function createOrderRecord(status: 'pending' | 'confirmed' = 'pending') {
	return {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455401',
		invoiceNumber: null,
		businessId: null,
		status,
		customerName: 'Walk-in Buyer',
		customerEmail: 'buyer@example.com',
		customerPhone: null,
		customerAddress: null,
		notes: null,
		itemCount: 3,
		subtotalAmount: 29.97,
		discountLabelId: null,
		discountLabelName: null,
		suggestedDiscountRate: null,
		discountRate: 0,
		discountAmount: 0,
		totalAmount: 29.97,
		version: 0,
		completedAt: null,
		cancelledAt: null,
		refundedAt: null,
		createdAt: new Date('2026-07-08T08:00:00.000Z'),
		updatedAt: new Date('2026-07-08T08:00:00.000Z'),
		business: null,
		items: [
			{
				id: '0189076c-4f2a-7fe1-b9fd-2d68df455402',
				orderId: '0189076c-4f2a-7fe1-b9fd-2d68df455401',
				productSkuId: null,
				skuCode: 'CUSTOM-001',
				productName: 'Custom Item',
				unitPrice: 9.99,
				quantity: 3,
				lineTotal: 29.97,
				attributes: {},
				createdAt: new Date('2026-07-08T08:00:00.000Z')
			}
		]
	};
}

function createUpdatePreview(
	status: 'pending' | 'confirmed' = 'pending'
): Awaited<ReturnType<OrderService['previewOrderUpdate']>> {
	const current = createOrderRecord();
	const proposedOrder = createOrderRecord(status);
	const previewItems = proposedOrder.items.map((item) => ({
		id: item.id,
		productSkuId: item.productSkuId,
		skuCode: item.skuCode,
		productName: item.productName,
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		lineTotal: item.lineTotal,
		attributes: item.attributes
	}));
	return {
		current,
		proposed: {
			version: current.version + 1,
			status,
			invoiceNumber: proposedOrder.invoiceNumber,
			businessId: proposedOrder.businessId,
			customerName: proposedOrder.customerName,
			customerEmail: proposedOrder.customerEmail,
			customerPhone: proposedOrder.customerPhone,
			customerAddress: proposedOrder.customerAddress,
			notes: proposedOrder.notes,
			itemCount: proposedOrder.itemCount,
			subtotalAmount: proposedOrder.subtotalAmount,
			discountLabelId: proposedOrder.discountLabelId,
			discountLabelName: proposedOrder.discountLabelName,
			suggestedDiscountRate: proposedOrder.suggestedDiscountRate,
			discountRate: proposedOrder.discountRate,
			discountAmount: proposedOrder.discountAmount,
			totalAmount: proposedOrder.totalAmount,
			items: previewItems
		},
		changes: {
			fields:
				status === current.status
					? []
					: [{ field: 'status' as const, before: current.status, after: status }],
			items: [],
			totals: {
				before: {
					itemCount: current.itemCount,
					subtotalAmount: current.subtotalAmount,
					discountAmount: current.discountAmount,
					totalAmount: current.totalAmount
				},
				after: {
					itemCount: proposedOrder.itemCount,
					subtotalAmount: proposedOrder.subtotalAmount,
					discountAmount: proposedOrder.discountAmount,
					totalAmount: proposedOrder.totalAmount
				}
			},
			inventory: []
		}
	};
}

function createUpdateResult(status: 'pending' | 'confirmed' = 'pending') {
	return {
		order: { ...createOrderRecord(status), version: 1 },
		previousStatus: 'pending' as const,
		preview: createUpdatePreview(status)
	};
}

function createAppWithOrders(
	orderService: Partial<
		Pick<
			OrderService,
			| 'listOrders'
			| 'listOrderSkuLookups'
			| 'createOrder'
			| 'getOrder'
			| 'updateOrderStatus'
			| 'previewOrderUpdate'
			| 'updateOrder'
		>
	>,
	logService: Pick<LogService, 'recordAuditLog'>,
	permissions = authContext.permissions
) {
	const app = express();

	app.use(express.json());
	app.use((_request, response, next) => {
		response.locals['auth'] = {
			...authContext,
			permissions
		};
		next();
	});
	app.use(
		'/api/management/orders',
		createOrderManagementRouter({
			orderService: {
				listOrders: async () => ({ data: [], total: 0 }),
				listOrderSkuLookups: async () => ({ data: [], total: 0 }),
				createOrder: async () => createOrderRecord(),
				getOrder: async () => createOrderRecord(),
				updateOrderStatus: async () => createUpdateResult('confirmed'),
				previewOrderUpdate: async () => createUpdatePreview(),
				updateOrder: async () => createUpdateResult(),
				...orderService
			} as OrderService,
			logService
		})
	);
	app.use(errorHandler);

	return app;
}

test('management order route creates an order and records an audit log', async () => {
	let auditInput: Parameters<Pick<LogService, 'recordAuditLog'>['recordAuditLog']>[0] | undefined;
	let createInput: unknown;
	const app = createAppWithOrders(
		{
			listOrders: async () => ({ data: [], total: 0 }),
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async (input) => {
				createInput = input;
				return createOrderRecord();
			},
			getOrder: async () => createOrderRecord(),
			updateOrderStatus: async () => createUpdateResult('confirmed')
		},
		{
			recordAuditLog: async (input) => {
				auditInput = input;
				return createAuditRecord();
			}
		}
	);

	const idempotencyKey = randomUUID();
	const response = await requestApp(app, {
		method: 'POST',
		path: '/api/management/orders',
		headers: {
			'Content-Type': 'application/json',
			'Idempotency-Key': idempotencyKey
		},
		body: JSON.stringify({
			businessId: null,
			invoiceNumber: 'inv001',
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
		})
	});

	assert.equal(response.status, 201, response.text());
	assert.equal((createInput as { invoiceNumber?: string } | undefined)?.invoiceNumber, 'INV001');
	assert.equal(auditInput?.entityType, 'order');
	assert.equal(auditInput?.entityId, createOrderRecord().id);
});

test('management order route updates order status and records transition metadata', async () => {
	let auditInput: Parameters<Pick<LogService, 'recordAuditLog'>['recordAuditLog']>[0] | undefined;
	const app = createAppWithOrders(
		{
			listOrders: async () => ({ data: [], total: 0 }),
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async () => createOrderRecord(),
			getOrder: async () => createOrderRecord(),
			updateOrderStatus: async () => createUpdateResult('confirmed')
		},
		{
			recordAuditLog: async (input) => {
				auditInput = input;
				return createAuditRecord();
			}
		}
	);

	const response = await requestApp(app, {
		method: 'PATCH',
		path: `/api/management/orders/${createOrderRecord().id}/status`,
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			status: 'confirmed'
		})
	});

	assert.equal(response.status, 200, response.text());
	assert.deepEqual(auditInput?.metadata, {
		previousStatus: 'pending',
		status: 'confirmed',
		inventoryAdjustment: null
	});
});

test('management order route previews a versioned item replacement without an audit log', async () => {
	let receivedInput: Parameters<OrderService['previewOrderUpdate']>[1] | undefined;
	let auditCount = 0;
	const app = createAppWithOrders(
		{
			previewOrderUpdate: async (_orderId, input) => {
				receivedInput = input;
				return createUpdatePreview();
			}
		},
		{
			recordAuditLog: async () => {
				auditCount += 1;
				return createAuditRecord();
			}
		}
	);

	const response = await requestApp(app, {
		method: 'POST',
		path: `/api/management/orders/${createOrderRecord().id}/preview`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			version: 0,
			items: [
				{
					id: createOrderRecord().items[0]?.id,
					skuCode: 'CUSTOM-001',
					productName: 'Custom Item',
					unitPrice: 9.99,
					quantity: 3
				}
			]
		})
	});

	assert.equal(response.status, 200, response.text());
	assert.equal(receivedInput?.version, 0);
	assert.equal(receivedInput?.items?.length, 1);
	assert.equal(auditCount, 0);

	const invalidResponse = await requestApp(app, {
		method: 'POST',
		path: `/api/management/orders/${createOrderRecord().id}/preview`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ customerName: 'Missing version' })
	});
	assert.equal(invalidResponse.status, 422, invalidResponse.text());
});

test('management order route records the server-derived item diff after an update', async () => {
	let auditInput: Parameters<LogService['recordAuditLog']>[0] | undefined;
	const result = createUpdateResult();
	const before = result.preview.proposed.items[0];
	assert.ok(before);
	const after = { ...before, quantity: 4, lineTotal: 39.96 };
	result.preview.changes.items = [
		{
			kind: 'modified',
			itemId: before.id,
			before,
			after
		}
	];
	result.preview.changes.totals.after = {
		itemCount: 4,
		subtotalAmount: 39.96,
		discountAmount: 0,
		totalAmount: 39.96
	};
	result.order = {
		...result.order,
		itemCount: 4,
		subtotalAmount: 39.96,
		totalAmount: 39.96,
		items: result.order.items.map((item) => ({
			...item,
			quantity: 4,
			lineTotal: 39.96
		}))
	};

	const app = createAppWithOrders(
		{ updateOrder: async () => result },
		{
			recordAuditLog: async (input) => {
				auditInput = input;
				return createAuditRecord();
			}
		}
	);
	const response = await requestApp(app, {
		method: 'PATCH',
		path: `/api/management/orders/${createOrderRecord().id}`,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			version: 0,
			items: [
				{
					id: before.id,
					skuCode: before.skuCode,
					productName: before.productName,
					unitPrice: before.unitPrice,
					quantity: 4
				}
			]
		})
	});

	assert.equal(response.status, 200, response.text());
	const metadata = auditInput?.metadata as Record<string, unknown> | undefined;
	assert.equal(metadata?.['versionBefore'], 0);
	assert.equal(metadata?.['versionAfter'], 1);
	assert.deepEqual(metadata?.['items'], result.preview.changes.items);
});

test('management order route passes invoice search to the order service', async () => {
	let receivedQuery: { page: number; limit: number; search?: string } | undefined;
	const app = createAppWithOrders(
		{
			listOrders: async (query) => {
				receivedQuery = query;
				return { data: [createOrderRecord()], total: 1 };
			}
		},
		{ recordAuditLog: async () => createAuditRecord() }
	);

	const response = await requestApp(app, {
		path: '/api/management/orders?search=INV001&page=2&limit=10'
	});
	const payload = response.json<{
		data: Array<{ id: string }>;
		pagination: { page: number; limit: number; total: number; totalPages: number };
	}>();

	assert.equal(response.status, 200, response.text());
	assert.deepEqual(receivedQuery, {
		page: 2,
		limit: 10,
		search: 'INV001',
		sort: 'createdAt',
		order: 'desc'
	});
	assert.equal(payload.data[0]?.id, createOrderRecord().id);
	assert.deepEqual(payload.pagination, { page: 2, limit: 10, total: 1, totalPages: 1 });
});

test('management order route requires read permission for list', async () => {
	const app = createAppWithOrders(
		{
			listOrders: async () => ({ data: [], total: 0 }),
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async () => createOrderRecord(),
			getOrder: async () => createOrderRecord(),
			updateOrderStatus: async () => createUpdateResult('confirmed')
		},
		{
			recordAuditLog: async () => createAuditRecord()
		},
		['order.write']
	);

	const response = await requestApp(app, {
		path: '/api/management/orders'
	});
	const payload = response.json<{ error: { code: string } }>();

	assert.equal(response.status, 403);
	assert.equal(payload.error.code, 'FORBIDDEN');
});

test('management order route lists SKU lookup records with order permission', async () => {
	let receivedQuery: { page: number; limit: number; search?: string } | undefined;
	const app = createAppWithOrders(
		{
			listOrders: async () => ({ data: [], total: 0 }),
			listOrderSkuLookups: async (query) => {
				receivedQuery = query;
				return {
					data: [
						{
							id: '0189076c-4f2a-7fe1-b9fd-2d68df455601',
							skuCode: 'SKU-1',
							productName: 'Catalog Item',
							price: 100,
							attributes: {}
						}
					],
					total: 1
				};
			},
			createOrder: async () => createOrderRecord(),
			getOrder: async () => createOrderRecord(),
			updateOrderStatus: async () => createUpdateResult('confirmed')
		},
		{ recordAuditLog: async () => createAuditRecord() },
		['order.write']
	);

	const response = await requestApp(app, {
		path: '/api/management/orders/product-skus?search=SKU&page=2&limit=10'
	});
	const payload = response.json<{
		data: Array<{ skuCode: string }>;
		pagination: { page: number; limit: number; total: number; totalPages: number };
	}>();

	assert.equal(response.status, 200, response.text());
	assert.deepEqual(receivedQuery, { page: 2, limit: 10, search: 'SKU' });
	assert.equal(payload.data[0]?.skuCode, 'SKU-1');
	assert.deepEqual(payload.pagination, { page: 2, limit: 10, total: 1, totalPages: 1 });
});

function createAuditRecord() {
	return {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455499',
		level: 'info' as const,
		kind: 'audit' as const,
		message: 'ok',
		actorStaffId: authContext.staffId,
		requestId: 'request-1',
		method: 'POST',
		path: '/api/management/orders',
		statusCode: 201,
		entityType: 'order',
		entityId: createOrderRecord().id,
		metadata: null,
		expiresAt: new Date('2026-08-01T00:00:00.000Z'),
		createdAt: new Date('2026-07-08T08:00:00.000Z')
	};
}
