import { z } from 'zod';

import { mfaMethodSchema, roleSchema, staffStatusSchema } from './auth.js';
import {
	booleanLikeSchema,
	dateSchema,
	emailAddressSchema,
	normalizedEmailAddressSchema,
	nonEmptyUpdate,
	paginationQuerySchema,
	searchQuerySchema,
	sortOrderSchema,
	uuidSchema
} from './common.js';

const staffNameSchema = z.string().trim().min(1).max(200);
const staffRoleIdsSchema = z
	.array(uuidSchema)
	.min(1)
	.max(20)
	.refine((roleIds) => new Set(roleIds).size === roleIds.length, 'Role ids must be unique.');

export const staffSchema = z.object({
	id: uuidSchema,
	email: emailAddressSchema,
	name: staffNameSchema,
	status: staffStatusSchema,
	preferredMfaMethod: z.preprocess((value) => value ?? null, mfaMethodSchema.nullable()),
	lastLoginAt: dateSchema.nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
	roles: z.array(roleSchema).default([])
});

export const staffListQuerySchema = paginationQuerySchema.extend({
	search: searchQuerySchema.optional(),
	status: staffStatusSchema.optional(),
	roleId: uuidSchema.optional(),
	includeDeleted: booleanLikeSchema.default(false),
	archived: booleanLikeSchema.optional(),
	sort: z.enum(['createdAt', 'updatedAt', 'name', 'email']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const staffCreateSchema = z.object({
	email: normalizedEmailAddressSchema,
	name: staffNameSchema,
	roleIds: staffRoleIdsSchema
});

export const staffUpdateSchema = nonEmptyUpdate(
	z.object({
		email: normalizedEmailAddressSchema.optional(),
		name: staffNameSchema.optional(),
		roleIds: staffRoleIdsSchema.optional(),
		status: staffStatusSchema.optional()
	})
);
