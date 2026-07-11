import { z } from 'zod';

import {
	attributeMapSchema,
	dateSchema,
	moneySchema,
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
	customerName: z.string().trim().min(1).nullable(),
	customerEmail: z.email().nullable(),
	customerPhone: z.string().trim().min(1).nullable(),
	customerAddress: z.string().trim().min(1).nullable(),
	itemCount: z.number().int().min(0),
	totalAmount: moneySchema,
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

export const orderCreateSchema = z.object({
	businessId: uuidSchema.optional(),
	customerName: z.string().trim().min(1).optional(),
	customerEmail: z.email().optional(),
	customerPhone: z.string().trim().min(1).optional(),
	customerAddress: z.string().trim().min(1).optional(),
	items: z.array(orderLineItemCreateSchema).min(1)
});

export const orderListQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional(),
	status: orderStatusSchema.optional(),
	businessId: uuidSchema.optional(),
	sort: z.enum(['createdAt', 'totalAmount']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const orderStatusUpdateSchema = z.object({
	status: orderStatusSchema
});
