import { z } from 'zod';

import {
	attributeMapSchema,
	dateSchema,
	emailAddressSchema,
	moneySchema,
	nonEmptyUpdate,
	paginationQuerySchema,
	searchQuerySchema,
	sortOrderSchema,
	uuidSchema
} from './common.js';
import { businessSchema } from './businesses.js';

export const orderStatusValues = [
	'pending',
	'confirmed',
	'processing',
	'completed',
	'cancelled',
	'refunded'
] as const;

export const orderStatusSchema = z.enum(orderStatusValues);

const orderCustomerNameSchema = z.string().trim().min(1).max(200);
const orderAddressSchema = z.string().trim().min(1).max(1_000);
const orderSkuCodeSchema = z.string().trim().min(1).max(120);
const orderProductNameSchema = z.string().trim().min(1).max(200);

const orderCustomerPhoneSchema = z
	.string()
	.trim()
	.max(32)
	.regex(/^\+?[0-9()\s-]+$/, 'Phone number contains unsupported characters.')
	.refine((value) => {
		const digitCount = value.replace(/\D/g, '').length;
		return digitCount >= 7 && digitCount <= 15;
	}, 'Phone number must contain between 7 and 15 digits.');

export const orderItemSchema = z.object({
	id: uuidSchema,
	orderId: uuidSchema,
	productSkuId: uuidSchema.nullable(),
	skuCode: orderSkuCodeSchema,
	productName: orderProductNameSchema,
	unitPrice: moneySchema,
	quantity: z.number().int().min(1).max(1_000_000),
	lineTotal: moneySchema,
	attributes: attributeMapSchema,
	createdAt: dateSchema
});

export const orderSchema = z.object({
	id: uuidSchema,
	businessId: uuidSchema.nullable(),
	status: orderStatusSchema,
	customerName: orderCustomerNameSchema.nullable(),
	customerEmail: emailAddressSchema.nullable(),
	customerPhone: orderCustomerPhoneSchema.nullable(),
	customerAddress: orderAddressSchema.nullable(),
	itemCount: z.number().int().min(0),
	subtotalAmount: moneySchema,
	discountLabelId: uuidSchema.nullable(),
	discountLabelName: z.string().trim().min(1).max(200).nullable(),
	suggestedDiscountRate: moneySchema.nullable(),
	discountRate: moneySchema,
	discountAmount: moneySchema,
	totalAmount: moneySchema,
	version: z.number().int().min(0),
	completedAt: dateSchema.nullable(),
	cancelledAt: dateSchema.nullable(),
	refundedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
	business: businessSchema.optional().nullable(),
	items: z.array(orderItemSchema).default([])
});

const orderItemQuantitySchema = z.coerce.number().int().min(1).max(1_000_000);

export const orderLineItemCreateSchema = z.union([
	z.object({
		productSkuId: uuidSchema,
		quantity: orderItemQuantitySchema
	}),
	z.object({
		productSkuId: z.undefined().optional(),
		skuCode: orderSkuCodeSchema,
		productName: orderProductNameSchema,
		unitPrice: moneySchema,
		quantity: orderItemQuantitySchema,
		attributes: attributeMapSchema.default({})
	})
]);

export const orderCreateSchema = z
	.object({
		businessId: uuidSchema.nullable().optional(),
		customerName: orderCustomerNameSchema.nullable().optional(),
		customerEmail: emailAddressSchema.nullable().optional(),
		customerPhone: orderCustomerPhoneSchema.nullable().optional(),
		customerAddress: orderAddressSchema.nullable().optional(),
		discountRate: z.coerce.number().min(0).max(100).multipleOf(0.01).optional(),
		items: z.array(orderLineItemCreateSchema).min(1).max(100)
	})
	.superRefine((order, context) => {
		if (order.businessId) return;

		if (!order.customerName) {
			context.addIssue({
				code: 'custom',
				path: ['customerName'],
				message: 'Customer name is required for consumer orders.'
			});
		}

		if (!order.customerPhone) {
			context.addIssue({
				code: 'custom',
				path: ['customerPhone'],
				message: 'Customer phone is required for consumer orders.'
			});
		}
	});

export const orderIdempotencyKeySchema = uuidSchema;

export const orderListQuerySchema = paginationQuerySchema.extend({
	search: searchQuerySchema.optional(),
	status: orderStatusSchema.optional(),
	businessId: uuidSchema.optional(),
	sort: z.enum(['createdAt', 'totalAmount']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const orderSkuLookupQuerySchema = paginationQuerySchema.extend({
	search: searchQuerySchema.optional()
});

export const orderStatusUpdateSchema = z.object({
	status: orderStatusSchema
});

export const orderUpdateSchema = nonEmptyUpdate(
	z.object({
		status: orderStatusSchema.optional(),
		businessId: uuidSchema.nullable().optional(),
		customerName: orderCustomerNameSchema.nullable().optional(),
		customerEmail: emailAddressSchema.nullable().optional(),
		customerPhone: orderCustomerPhoneSchema.nullable().optional(),
		customerAddress: orderAddressSchema.nullable().optional()
	})
);
