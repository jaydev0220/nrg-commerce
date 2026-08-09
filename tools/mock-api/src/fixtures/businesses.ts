import type { MockBusiness, MockBusinessLabel, MockOrder } from '../state.js';
import { archivedTime, fixtureTime, ids } from './ids.js';

export function createBusinessLabelFixtures(): MockBusinessLabel[] {
	return [
		{
			id: ids.labelPreferred,
			name: 'Preferred',
			color: '#2563EB',
			discountRate: 10,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.labelWholesale,
			name: 'Wholesale',
			color: '#059669',
			discountRate: 15,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.labelArchived,
			name: 'Archived Label',
			color: '#6B7280',
			discountRate: null,
			deletedAt: archivedTime,
			createdAt: fixtureTime,
			updatedAt: archivedTime
		}
	];
}

export function createBusinessFixtures(): MockBusiness[] {
	return [
		{
			id: ids.businessAlpha,
			name: 'Alpha Laboratory',
			contactName: 'Lin Wei',
			contactEmail: 'lin@example.com',
			contactPhone: '02-2345-6789',
			taxId: '12345678',
			address: 'Taipei City',
			notes: 'Preferred account fixture.',
			labelId: ids.labelPreferred,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.businessBeta,
			name: 'Beta Science',
			contactName: 'Chen Yu',
			contactEmail: 'chen@example.com',
			contactPhone: '03-555-0188',
			taxId: '87654321',
			address: 'Hsinchu City',
			notes: null,
			labelId: ids.labelWholesale,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.businessArchived,
			name: 'Archived Customer',
			contactName: null,
			contactEmail: null,
			contactPhone: null,
			taxId: null,
			address: null,
			notes: null,
			labelId: null,
			deletedAt: archivedTime,
			createdAt: fixtureTime,
			updatedAt: archivedTime
		}
	];
}

function makeOrder(input: {
	id: string;
	itemId: string;
	status: MockOrder['status'];
	createdAt: Date;
	businessId?: string;
	invoiceNumber?: string;
	skuId: string;
	skuCode: string;
	productName: string;
	unitPrice: number;
	quantity: number;
	discountRate?: number;
	discountLabelId?: string;
	discountLabelName?: string;
}): MockOrder {
	const subtotalAmount = input.unitPrice * input.quantity;
	const discountRate = input.discountRate ?? 0;
	const discountAmount = Math.round(subtotalAmount * discountRate) / 100;
	const totalAmount = subtotalAmount - discountAmount;
	const completedAt = input.status === 'completed' ? input.createdAt : null;
	const cancelledAt = input.status === 'cancelled' ? input.createdAt : null;
	const refundedAt = input.status === 'refunded' ? input.createdAt : null;

	return {
		id: input.id,
		invoiceNumber: input.invoiceNumber ?? null,
		businessId: input.businessId ?? null,
		status: input.status,
		customerName: input.businessId ? null : 'Walk-in Customer',
		customerEmail: input.businessId ? null : 'customer@example.com',
		customerPhone: input.businessId ? null : '0912345678',
		customerAddress: input.businessId ? null : 'Taipei City',
		notes: null,
		itemCount: input.quantity,
		subtotalAmount,
		discountLabelId: input.discountLabelId ?? null,
		discountLabelName: input.discountLabelName ?? null,
		suggestedDiscountRate: input.discountRate ?? null,
		discountRate,
		discountAmount,
		totalAmount,
		version: 0,
		completedAt,
		cancelledAt,
		refundedAt,
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
		items: [
			{
				id: input.itemId,
				orderId: input.id,
				productSkuId: input.skuId,
				skuCode: input.skuCode,
				productName: input.productName,
				unitPrice: input.unitPrice,
				quantity: input.quantity,
				lineTotal: subtotalAmount,
				attributes: {},
				createdAt: input.createdAt
			}
		]
	};
}

export function createOrderFixtures(): MockOrder[] {
	const preferredDiscount = {
		discountRate: 10,
		discountLabelId: ids.labelPreferred,
		discountLabelName: 'Preferred'
	};
	return [
		makeOrder({
			id: ids.orderPending,
			itemId: ids.orderItem1,
			status: 'pending',
			createdAt: new Date('2026-07-14T04:00:00.000Z'),
			skuId: ids.skuBeaker100,
			skuCode: 'BEAKER-100',
			productName: '實驗室燒杯',
			unitPrice: 120,
			quantity: 1
		}),
		makeOrder({
			id: ids.orderConfirmed,
			itemId: ids.orderItem2,
			status: 'confirmed',
			createdAt: new Date('2026-07-15T04:00:00.000Z'),
			businessId: ids.businessAlpha,
			invoiceNumber: 'INV1001',
			skuId: ids.skuBeaker250,
			skuCode: 'BEAKER-250',
			productName: '實驗室燒杯',
			unitPrice: 180,
			quantity: 3,
			...preferredDiscount
		}),
		makeOrder({
			id: ids.orderProcessing,
			itemId: ids.orderItem3,
			status: 'processing',
			createdAt: new Date('2026-07-16T04:00:00.000Z'),
			businessId: ids.businessBeta,
			invoiceNumber: 'INV1002',
			skuId: ids.skuFunnel75,
			skuCode: 'FUNNEL-75',
			productName: '玻璃漏斗',
			unitPrice: 90,
			quantity: 5,
			discountRate: 15,
			discountLabelId: ids.labelWholesale,
			discountLabelName: 'Wholesale'
		}),
		makeOrder({
			id: ids.orderCompleted,
			itemId: ids.orderItem4,
			status: 'completed',
			createdAt: new Date('2026-07-17T04:00:00.000Z'),
			businessId: ids.businessAlpha,
			invoiceNumber: 'INV1003',
			skuId: ids.skuBeaker100,
			skuCode: 'BEAKER-100',
			productName: '實驗室燒杯',
			unitPrice: 120,
			quantity: 10,
			...preferredDiscount
		}),
		makeOrder({
			id: ids.orderCancelled,
			itemId: ids.orderItem5,
			status: 'cancelled',
			createdAt: new Date('2026-07-18T04:00:00.000Z'),
			skuId: ids.skuFunnel75,
			skuCode: 'FUNNEL-75',
			productName: '玻璃漏斗',
			unitPrice: 90,
			quantity: 1
		}),
		makeOrder({
			id: ids.orderRefunded,
			itemId: ids.orderItem6,
			status: 'refunded',
			createdAt: new Date('2026-07-19T04:00:00.000Z'),
			skuId: ids.skuBeaker100,
			skuCode: 'BEAKER-100',
			productName: '實驗室燒杯',
			unitPrice: 120,
			quantity: 2
		})
	];
}
