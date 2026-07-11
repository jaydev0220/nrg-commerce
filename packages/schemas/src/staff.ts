import { z } from 'zod';

import { mfaMethodSchema, roleSchema, staffStatusSchema } from './auth.js';
import {
	booleanLikeSchema,
	dateSchema,
	nonEmptyUpdate,
	paginationQuerySchema,
	sortOrderSchema,
	uuidSchema
} from './common.js';

export const staffSchema = z.object({
	id: uuidSchema,
	email: z.email(),
	name: z.string().min(1),
	status: staffStatusSchema,
	passwordHash: z.string().min(1).nullable(),
	mfaRequired: z.boolean(),
	preferredMfaMethod: z.preprocess((value) => value ?? null, mfaMethodSchema.nullable()),
	lastLoginAt: dateSchema.nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
	roles: z.array(roleSchema).default([])
});

export const staffListQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional(),
	status: staffStatusSchema.optional(),
	roleId: uuidSchema.optional(),
	sort: z.enum(['createdAt', 'updatedAt', 'name', 'email']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const staffCreateSchema = z.object({
	email: z.email(),
	name: z.string().trim().min(1),
	roleIds: z.array(uuidSchema).min(1)
});

export const staffUpdateSchema = nonEmptyUpdate(
	z.object({
		email: z.email().optional(),
		name: z.string().trim().min(1).optional(),
		roleIds: z.array(uuidSchema).min(1).optional(),
		status: staffStatusSchema.optional()
	})
);

export const staffDeleteQuerySchema = z.object({
	force: booleanLikeSchema.default(false)
});

export const staffPasswordUpdateSchema = z.object({
	password: z.string().min(8)
});
