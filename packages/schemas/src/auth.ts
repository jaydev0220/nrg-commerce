import { z } from 'zod';

import { booleanLikeSchema, dateSchema, uuidSchema } from './common.js';

export const staffStatusValues = ['active', 'inactive', 'suspended'] as const;
export const mfaMethodValues = ['authenticator', 'passkey'] as const;
export const passkeyDeviceTypeValues = ['singleDevice', 'multiDevice'] as const;
export const authPrimaryFactorValues = ['password', 'passkey'] as const;

export const staffStatusSchema = z.enum(staffStatusValues);
export const mfaMethodSchema = z.enum(mfaMethodValues);
export const passkeyDeviceTypeSchema = z.enum(passkeyDeviceTypeValues);
export const authPrimaryFactorSchema = z.enum(authPrimaryFactorValues);
export const permissionKeySchema = z.enum([
	'business.read',
	'business.write',
	'order.read',
	'order.write',
	'product.read',
	'product.create',
	'product.update',
	'product.delete',
	'product.sku.read',
	'product.sku.create',
	'product.sku.update',
	'product.sku.delete',
	'product.category.read',
	'product.category.create',
	'product.category.update',
	'product.category.delete',
	'product.image.read',
	'product.image.create',
	'product.image.delete',
	'log.read',
	'staff.read',
	'staff.create',
	'staff.update',
	'staff.delete'
]);
export const roleKeySchema = z.enum(['admin', 'catalog-manager', 'staff-manager', 'sales-manager']);

export const permissionSchema = z.object({
	id: uuidSchema,
	key: permissionKeySchema,
	name: z.string().min(1),
	description: z.string().min(1).nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const roleSchema = z.object({
	id: uuidSchema,
	key: roleKeySchema,
	name: z.string().min(1),
	description: z.string().min(1).nullable(),
	permissions: z.array(permissionSchema).default([]),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const totpCredentialSchema = z.object({
	id: uuidSchema,
	staffId: uuidSchema,
	secretEncrypted: z.string().min(1),
	digits: z.number().int().min(6).max(8),
	period: z.number().int().min(15).max(120),
	verifiedAt: dateSchema.nullable(),
	lastUsedAt: dateSchema.nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const passkeyCredentialSchema = z.object({
	id: uuidSchema,
	staffId: uuidSchema,
	credentialId: z.string().min(1),
	publicKey: z.instanceof(Uint8Array),
	userHandle: z.string().min(1).nullable(),
	counter: z.number().int().min(0),
	transports: z.array(z.string().min(1)).default([]),
	aaguid: z.string().min(1).nullable(),
	deviceType: passkeyDeviceTypeSchema.nullable(),
	backedUp: z.boolean().nullable(),
	nickname: z.string().min(1).nullable(),
	verifiedAt: dateSchema.nullable(),
	lastUsedAt: dateSchema.nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const authSessionSchema = z.object({
	id: uuidSchema,
	staffId: uuidSchema,
	userAgent: z.string().min(1).nullable(),
	ipAddress: z.string().min(1).nullable(),
	authenticatedAt: dateSchema,
	lastSeenAt: dateSchema.nullable(),
	expiresAt: dateSchema,
	revokedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const refreshTokenRecordSchema = z.object({
	id: uuidSchema,
	sessionId: uuidSchema,
	jwtId: z.string().min(1),
	tokenHash: z.string().min(1),
	previousTokenId: uuidSchema.nullable(),
	issuedAt: dateSchema,
	expiresAt: dateSchema,
	lastUsedAt: dateSchema.nullable(),
	consumedAt: dateSchema.nullable(),
	revokedAt: dateSchema.nullable(),
	createdAt: dateSchema
});

export const accessTokenClaimsSchema = z.object({
	sub: uuidSchema,
	sid: uuidSchema,
	jti: z.string().min(1),
	type: z.literal('access'),
	roles: z.array(roleKeySchema).default([]),
	permissions: z.array(permissionKeySchema).default([]),
	mfa: z.array(mfaMethodSchema).default([]),
	primaryFactor: authPrimaryFactorSchema,
	exp: z.number().int().positive(),
	iat: z.number().int().positive()
});

export const refreshTokenClaimsSchema = z.object({
	sub: uuidSchema,
	sid: uuidSchema,
	jti: z.string().min(1),
	type: z.literal('refresh'),
	mfa: z.array(mfaMethodSchema).default([]),
	primaryFactor: authPrimaryFactorSchema,
	exp: z.number().int().positive(),
	iat: z.number().int().positive()
});

export const refreshTokenRequestSchema = z.object({
	refreshToken: z.string().min(1)
});

export const totpChallengeSchema = z.object({
	code: z.string().regex(/^\d{6,8}$/)
});

export const mfaPreferenceSchema = z.object({
	mfaRequired: booleanLikeSchema.default(false),
	preferredMfaMethod: mfaMethodSchema.nullable().optional()
});

export const passwordLoginSchema = z.object({
	email: z.email(),
	password: z.string().min(8)
});

export const pendingAuthTokenSchema = z.object({
	pendingToken: z.string().min(1)
});

export const setupTokenRequestSchema = z.object({
	setupToken: z.string().min(1)
});

export const passkeyAuthenticationStartSchema = z.object({
	email: z.email()
});

export const passkeyAuthenticationVerificationSchema = z.object({
	ceremonyToken: z.string().min(1),
	credential: z.unknown()
});

export const passkeyRegistrationStartSchema = z.object({
	nickname: z.string().trim().min(1).optional()
});

export const totpSetupConfirmationSchema = z.object({
	setupToken: z.string().min(1),
	code: z.string().regex(/^\d{6,8}$/)
});
