import { z } from 'zod';

import {
	booleanLikeSchema,
	dateSchema,
	nonEmptyUpdate,
	paginationQuerySchema,
	sortOrderSchema,
	uuidSchema
} from './common.js';

export const businessSchema = z.object({
	id: uuidSchema,
	name: z.string().trim().min(1),
	contactName: z.string().trim().min(1).nullable(),
	contactEmail: z.email().nullable(),
	contactPhone: z.string().trim().min(1).nullable(),
	taxId: z.string().trim().min(1).nullable(),
	address: z.string().trim().min(1).nullable(),
	notes: z.string().trim().min(1).nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const businessListQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional(),
	includeDeleted: booleanLikeSchema.default(false),
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
	notes: z.string().trim().min(1).optional()
});

export const businessUpdateSchema = nonEmptyUpdate(
	z.object({
		name: z.string().trim().min(1).optional(),
		contactName: z.string().trim().min(1).nullable().optional(),
		contactEmail: z.email().nullable().optional(),
		contactPhone: z.string().trim().min(1).nullable().optional(),
		taxId: z.string().trim().min(1).nullable().optional(),
		address: z.string().trim().min(1).nullable().optional(),
		notes: z.string().trim().min(1).nullable().optional()
	})
);
