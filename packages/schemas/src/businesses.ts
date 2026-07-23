import { z } from 'zod';

import {
	booleanLikeSchema,
	dateSchema,
	emailAddressSchema,
	nonEmptyUpdate,
	paginationQuerySchema,
	searchQuerySchema,
	sortOrderSchema,
	uuidSchema
} from './common.js';

const businessNameSchema = z.string().trim().min(1).max(200);
const businessLabelNameSchema = z.string().trim().min(1).max(100);
const contactTextSchema = z.string().trim().min(1).max(200);
const contactPhoneSchema = z.string().trim().min(1).max(64);
const taxIdSchema = z.string().trim().min(1).max(64);
const addressSchema = z.string().trim().min(1).max(1_000);
const notesSchema = z.string().trim().min(1).max(10_000);

export const businessLabelColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const businessLabelSchema = z.object({
	id: uuidSchema,
	name: businessLabelNameSchema,
	color: businessLabelColorSchema,
	discountRate: z.number().min(0).max(100).multipleOf(0.01).nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const businessSchema = z.object({
	id: uuidSchema,
	name: businessNameSchema,
	contactName: contactTextSchema.nullable(),
	contactEmail: emailAddressSchema.nullable(),
	contactPhone: contactPhoneSchema.nullable(),
	taxId: taxIdSchema.nullable(),
	address: addressSchema.nullable(),
	notes: notesSchema.nullable(),
	labelId: uuidSchema.nullable(),
	label: businessLabelSchema.nullable().optional(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const businessListQuerySchema = paginationQuerySchema.extend({
	search: searchQuerySchema.optional(),
	includeDeleted: booleanLikeSchema.default(false),
	archived: booleanLikeSchema.optional(),
	labelId: uuidSchema.optional(),
	sort: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const businessCreateSchema = z.object({
	name: businessNameSchema,
	contactName: contactTextSchema.optional(),
	contactEmail: emailAddressSchema.optional(),
	contactPhone: contactPhoneSchema.optional(),
	taxId: taxIdSchema.optional(),
	address: addressSchema.optional(),
	notes: notesSchema.optional(),
	labelId: uuidSchema.nullable().optional()
});

export const businessUpdateSchema = nonEmptyUpdate(
	z.object({
		name: businessNameSchema.optional(),
		contactName: contactTextSchema.nullable().optional(),
		contactEmail: emailAddressSchema.nullable().optional(),
		contactPhone: contactPhoneSchema.nullable().optional(),
		taxId: taxIdSchema.nullable().optional(),
		address: addressSchema.nullable().optional(),
		notes: notesSchema.nullable().optional(),
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
	search: searchQuerySchema.optional()
});

export const businessLabelCreateSchema = z.object({
	name: businessLabelNameSchema,
	color: businessLabelColorSchema,
	discountRate: z.number().min(0).max(100).multipleOf(0.01).nullable().optional()
});

export const businessLabelUpdateSchema = nonEmptyUpdate(
	z.object({
		name: businessLabelNameSchema.optional(),
		color: businessLabelColorSchema.optional(),
		discountRate: z.number().min(0).max(100).multipleOf(0.01).nullable().optional()
	})
);
