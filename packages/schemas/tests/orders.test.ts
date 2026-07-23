import assert from 'node:assert/strict';
import test from 'node:test';

import {
	businessBulkLabelUpdateSchema,
	orderCreateSchema,
	orderListQuerySchema,
	orderSkuLookupQuerySchema,
	orderUpdateSchema
} from '../src/index.js';

const orderItem = {
	skuCode: 'CUSTOM-001',
	productName: 'Custom Item',
	unitPrice: 9.99,
	quantity: 1,
	attributes: {}
};

test('orderCreateSchema accepts null business and optional customer fields for business orders', () => {
	const order = orderCreateSchema.parse({
		businessId: '0189076c-4f2a-7fe1-b9fd-2d68df455301',
		customerName: null,
		customerEmail: null,
		customerPhone: null,
		customerAddress: null,
		items: [orderItem]
	});

	assert.equal(order.businessId, '0189076c-4f2a-7fe1-b9fd-2d68df455301');
});

test('orderCreateSchema strips caller-provided snapshots from catalog SKU lines', () => {
	const order = orderCreateSchema.parse({
		customerName: 'Walk-in Buyer',
		customerPhone: '0912345678',
		items: [
			{
				productSkuId: '0189076c-4f2a-7fe1-b9fd-2d68df455301',
				skuCode: 'SPOOFED',
				productName: 'Spoofed item',
				unitPrice: 0.01,
				quantity: 2,
				attributes: { spoofed: true }
			}
		]
	});

	assert.deepEqual(order.items[0], {
		productSkuId: '0189076c-4f2a-7fe1-b9fd-2d68df455301',
		quantity: 2
	});
});

test('orderCreateSchema requires consumer name and phone and validates phone formatting', () => {
	const order = orderCreateSchema.parse({
		businessId: null,
		customerName: 'Walk-in Buyer',
		customerPhone: '+886 (912) 345-678',
		items: [orderItem]
	});

	assert.equal(order.businessId, null);
	assert.throws(() =>
		orderCreateSchema.parse({
			businessId: null,
			customerName: null,
			customerPhone: '+886 912 345 678',
			items: [orderItem]
		})
	);
	assert.throws(() =>
		orderCreateSchema.parse({
			businessId: null,
			customerName: 'Walk-in Buyer',
			customerPhone: null,
			items: [orderItem]
		})
	);
	assert.throws(() =>
		orderCreateSchema.parse({
			businessId: null,
			customerName: 'Walk-in Buyer',
			customerPhone: '123-45',
			items: [orderItem]
		})
	);
});

test('orderUpdateSchema accepts customer updates and rejects item replacement', () => {
	assert.deepEqual(orderUpdateSchema.parse({ customerName: 'Updated buyer' }), {
		customerName: 'Updated buyer'
	});
	assert.throws(() => orderUpdateSchema.parse({ items: [] }));
});

test('bulk business label updates require unique business ids and allow clearing a label', () => {
	const input = businessBulkLabelUpdateSchema.parse({
		businessIds: ['0189076c-4f2a-7fe1-b9fd-2d68df455301'],
		labelId: null
	});

	assert.equal(input.labelId, null);
	assert.throws(() =>
		businessBulkLabelUpdateSchema.parse({
			businessIds: ['0189076c-4f2a-7fe1-b9fd-2d68df455301', '0189076c-4f2a-7fe1-b9fd-2d68df455301'],
			labelId: null
		})
	);
});

test('order SKU lookup query coerces pagination values and trims search', () => {
	assert.deepEqual(orderSkuLookupQuerySchema.parse({ page: '2', limit: '10', search: ' SKU-1 ' }), {
		page: 2,
		limit: 10,
		search: 'SKU-1'
	});
});

test('order request schemas reject oversized customer, item, and search values', () => {
	assert.throws(() =>
		orderCreateSchema.parse({
			customerName: 'a'.repeat(201),
			customerPhone: '+886 912 345 678',
			items: [orderItem]
		})
	);
	assert.throws(() =>
		orderCreateSchema.parse({
			customerName: 'Customer',
			customerPhone: '+886 912 345 678',
			customerAddress: 'a'.repeat(1_001),
			items: [orderItem]
		})
	);
	assert.throws(() =>
		orderCreateSchema.parse({
			customerName: 'Customer',
			customerPhone: '+886 912 345 678',
			items: [{ ...orderItem, skuCode: 'a'.repeat(121) }]
		})
	);
	assert.throws(() => orderListQuerySchema.parse({ search: 'a'.repeat(201) }));
});
