import assert from 'node:assert/strict';
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
		roles: [],
		totpCredentialCount: 1,
		passkeyCredentialCount: 0
	}
};

function createOrderRecord(status: 'pending' | 'confirmed' = 'pending') {
	return {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455401',
		businessId: null,
		status,
		customerName: 'Walk-in Buyer',
		customerEmail: 'buyer@example.com',
		customerPhone: null,
		customerAddress: null,
		itemCount: 3,
		subtotalAmount: 29.97,
		discountLabelId: null,
		discountLabelName: null,
		suggestedDiscountRate: null,
		discountRate: 0,
		discountAmount: 0,
		totalAmount: 29.97,
		completedAt: null,
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

function createAppWithOrders(
	orderService: Pick<
		OrderService,
		| 'listOrders'
		| 'listOrderSkuLookups'
		| 'createOrder'
		| 'getOrder'
		| 'updateOrderStatus'
		| 'updateOrder'
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
			orderService: orderService as OrderService,
			logService
		})
	);
	app.use(errorHandler);

	return app;
}

test('management order route creates an order and records an audit log', async () => {
	let auditInput: Parameters<Pick<LogService, 'recordAuditLog'>['recordAuditLog']>[0] | undefined;
	const app = createAppWithOrders(
		{
			listOrders: async () => ({ data: [], total: 0 }),
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async () => createOrderRecord(),
			getOrder: async () => createOrderRecord(),
			updateOrderStatus: async () => ({
				order: createOrderRecord('confirmed'),
				previousStatus: 'pending'
			}),
			updateOrder: async () => ({ order: createOrderRecord(), previousStatus: 'pending' })
		},
		{
			recordAuditLog: async (input) => {
				auditInput = input;
				return createAuditRecord();
			}
		}
	);

	const response = await requestApp(app, {
		method: 'POST',
		path: '/api/management/orders',
		headers: {
			'Content-Type': 'application/json',
			'Idempotency-Key': '0189076c-4f2a-7fe1-b9fd-2d68df455403'
		},
		body: JSON.stringify({
			businessId: null,
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
			updateOrderStatus: async () => ({
				order: createOrderRecord('confirmed'),
				previousStatus: 'pending'
			}),
			updateOrder: async () => ({ order: createOrderRecord(), previousStatus: 'pending' })
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
		status: 'confirmed'
	});
});

test('management order route requires read permission for list', async () => {
	const app = createAppWithOrders(
		{
			listOrders: async () => ({ data: [], total: 0 }),
			listOrderSkuLookups: async () => ({ data: [], total: 0 }),
			createOrder: async () => createOrderRecord(),
			getOrder: async () => createOrderRecord(),
			updateOrderStatus: async () => ({
				order: createOrderRecord('confirmed'),
				previousStatus: 'pending'
			}),
			updateOrder: async () => ({ order: createOrderRecord(), previousStatus: 'pending' })
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
			updateOrderStatus: async () => ({
				order: createOrderRecord('confirmed'),
				previousStatus: 'pending'
			}),
			updateOrder: async () => ({ order: createOrderRecord(), previousStatus: 'pending' })
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
