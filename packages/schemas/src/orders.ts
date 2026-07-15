import { z } from 'zod';

import {
	attributeMapSchema,
	dateSchema,
	moneySchema,
	nonEmptyUpdate,
	paginationQuerySchema,
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

const orderCustomerNameSchema = z.string().trim().min(1);

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
	skuCode: z.string().trim().min(1),
	productName: z.string().trim().min(1),
	unitPrice: moneySchema,
	quantity: z.number().int().min(1),
	lineTotal: moneySchema,
	attributes: attributeMapSchema,
	createdAt: dateSchema
});

export const orderSchema = z.object({
	id: uuidSchema,
	businessId: uuidSchema.nullable(),
	status: orderStatusSchema,
	customerName: orderCustomerNameSchema.nullable(),
	customerEmail: z.email().nullable(),
	customerPhone: z.string().trim().min(1).nullable(),
	customerAddress: z.string().trim().min(1).nullable(),
	itemCount: z.number().int().min(0),
	subtotalAmount: moneySchema,
	discountLabelId: uuidSchema.nullable(),
	discountLabelName: z.string().trim().min(1).nullable(),
	suggestedDiscountRate: moneySchema.nullable(),
	discountRate: moneySchema,
	discountAmount: moneySchema,
	totalAmount: moneySchema,
	completedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
	business: businessSchema.optional().nullable(),
	items: z.array(orderItemSchema).default([])
});

export const orderLineItemCreateSchema = z.object({
	productSkuId: uuidSchema.optional(),
	skuCode: z.string().trim().min(1),
	productName: z.string().trim().min(1),
	unitPrice: moneySchema,
	quantity: z.coerce.number().int().min(1),
	attributes: attributeMapSchema.default({})
});

export const orderCreateSchema = z
	.object({
		businessId: uuidSchema.nullable().optional(),
		customerName: orderCustomerNameSchema.nullable().optional(),
		customerEmail: z.email().nullable().optional(),
		customerPhone: orderCustomerPhoneSchema.nullable().optional(),
		customerAddress: z.string().trim().min(1).nullable().optional(),
		discountRate: z.coerce.number().min(0).max(100).multipleOf(0.01).optional(),
		items: z.array(orderLineItemCreateSchema).min(1)
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
	search: z.string().trim().min(1).optional(),
	status: orderStatusSchema.optional(),
	businessId: uuidSchema.optional(),
	sort: z.enum(['createdAt', 'totalAmount']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const orderSkuLookupQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional()
});

export const orderStatusUpdateSchema = z.object({
	status: orderStatusSchema
});

export const orderUpdateSchema = nonEmptyUpdate(
	z.object({
		status: orderStatusSchema.optional(),
		businessId: uuidSchema.nullable().optional(),
		customerName: orderCustomerNameSchema.nullable().optional(),
		customerEmail: z.email().nullable().optional(),
		customerPhone: orderCustomerPhoneSchema.nullable().optional(),
		customerAddress: z.string().trim().min(1).nullable().optional()
	})
);
