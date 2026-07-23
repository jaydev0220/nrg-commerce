import { z } from 'zod';

import {
	dateSchema,
	jsonValueSchema,
	paginationQuerySchema,
	sortOrderSchema,
	uuidSchema
} from './common.js';

export const logLevelValues = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export const logKindValues = ['audit', 'request'] as const;

export const logLevelSchema = z.enum(logLevelValues);
export const logKindSchema = z.enum(logKindValues);

export const logSchema = z.object({
	id: uuidSchema,
	level: logLevelSchema,
	kind: logKindSchema,
	message: z.string().min(1),
	actorStaffId: uuidSchema.nullable(),
	requestId: z.string().min(1).nullable(),
	method: z.string().min(1).nullable(),
	path: z.string().min(1).nullable(),
	statusCode: z.number().int().min(100).max(599).nullable(),
	entityType: z.string().min(1).nullable(),
	entityId: z.string().min(1).nullable(),
	metadata: jsonValueSchema.nullable(),
	expiresAt: dateSchema,
	createdAt: dateSchema
});

export const managementLogListQuerySchema = paginationQuerySchema.extend({
	kind: logKindSchema.optional(),
	level: logLevelSchema.optional(),
	actorStaffId: uuidSchema.optional(),
	requestId: z.string().trim().min(1).max(128).optional(),
	sort: z.enum(['createdAt', 'expiresAt']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});
