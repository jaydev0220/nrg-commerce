import { z } from 'zod';

import {
	booleanLikeSchema,
	dateSchema,
	nonEmptyUpdate,
	paginationQuerySchema,
	sortOrderSchema,
	uuidSchema
} from './common.js';

export const businessLabelColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const businessLabelSchema = z.object({
	id: uuidSchema,
	name: z.string().trim().min(1),
	color: businessLabelColorSchema,
	discountRate: z.number().min(0).max(100).multipleOf(0.01).nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const businessSchema = z.object({
	id: uuidSchema,
	name: z.string().trim().min(1),
	contactName: z.string().trim().min(1).nullable(),
	contactEmail: z.email().nullable(),
	contactPhone: z.string().trim().min(1).nullable(),
	taxId: z.string().trim().min(1).nullable(),
	address: z.string().trim().min(1).nullable(),
	notes: z.string().trim().min(1).nullable(),
	labelId: uuidSchema.nullable(),
	label: businessLabelSchema.nullable().optional(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const businessListQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional(),
	includeDeleted: booleanLikeSchema.default(false),
	archived: booleanLikeSchema.optional(),
	labelId: uuidSchema.optional(),
	sort: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const businessCreateSchema = z.object({
	name: z.string().trim().min(1),
	contactName: z.string().trim().min(1).optional(),
	contactEmail: z.email().optional(),
	contactPhone: z.string().trim().min(1).optional(),
	taxId: z.string().trim().min(1).optional(),
	address: z.string().trim().min(1).optional(),
	notes: z.string().trim().min(1).optional(),
	labelId: uuidSchema.nullable().optional()
});

export const businessUpdateSchema = nonEmptyUpdate(
	z.object({
		name: z.string().trim().min(1).optional(),
		contactName: z.string().trim().min(1).nullable().optional(),
		contactEmail: z.email().nullable().optional(),
		contactPhone: z.string().trim().min(1).nullable().optional(),
		taxId: z.string().trim().min(1).nullable().optional(),
		address: z.string().trim().min(1).nullable().optional(),
		notes: z.string().trim().min(1).nullable().optional(),
		labelId: uuidSchema.nullable().optional()
	})
);

export const businessBulkLabelUpdateSchema = z.object({
	businessIds: z
		.array(uuidSchema)
		.min(1)
		.max(100)
		.refine((businessIds) => new Set(businessIds).size === businessIds.length),
	labelId: uuidSchema.nullable()
});

export const businessLabelListQuerySchema = paginationQuerySchema.extend({
	includeDeleted: booleanLikeSchema.default(false),
	search: z.string().trim().min(1).optional()
});

export const businessLabelCreateSchema = z.object({
	name: z.string().trim().min(1),
	color: businessLabelColorSchema,
	discountRate: z.number().min(0).max(100).multipleOf(0.01).nullable().optional()
});

export const businessLabelUpdateSchema = nonEmptyUpdate(
	z.object({
		name: z.string().trim().min(1).optional(),
		color: businessLabelColorSchema.optional(),
		discountRate: z.number().min(0).max(100).multipleOf(0.01).nullable().optional()
	})
);
