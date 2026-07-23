import { z } from 'zod';

import {
	authSessionSchema,
	mfaMethodSchema,
	passkeyDeviceTypeSchema,
	permissionKeySchema,
	roleKeySchema,
	staffStatusSchema
} from './auth.js';
import { businessLabelSchema, businessSchema } from './businesses.js';
import {
	attributeMapSchema,
	dateSchema,
	jsonValueSchema,
	serializedDateSchema,
	uuidSchema
} from './common.js';
import { logSchema } from './logs.js';
import { orderItemSchema, orderSchema } from './orders.js';
import {
	productCategorySchema,
	productImageSchema,
	productImagePlacementSchema
} from './products.js';

export const paginationResponseSchema = z.object({
	page: z.number().int().min(1),
	limit: z.number().int().min(1).max(100),
	total: z.number().int().min(0),
	totalPages: z.number().int().min(0)
});

export function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
	return z.object({
		data: z.array(itemSchema),
		pagination: paginationResponseSchema
	});
}

export const managedRoleResponseSchema = z.object({
	id: uuidSchema,
	key: roleKeySchema,
	name: z.string().min(1),
	permissions: z.array(permissionKeySchema)
});

export const currentStaffResponseSchema = z.object({
	id: uuidSchema,
	email: z.email(),
	name: z.string().min(1),
	status: staffStatusSchema,
	preferredMfaMethod: mfaMethodSchema.nullable(),
	lastLoginAt: dateSchema.nullable(),
	roles: z.array(managedRoleResponseSchema),
	totpCredentialCount: z.number().int().min(0),
	passkeyCredentialCount: z.number().int().min(0)
});

export const currentStaffEnvelopeResponseSchema = z.object({
	staff: currentStaffResponseSchema,
	sessionId: uuidSchema,
	mfaMethods: z.array(mfaMethodSchema)
});

export const managedAuthSessionResponseSchema = authSessionSchema.pick({
	id: true,
	staffId: true,
	userAgent: true,
	ipAddress: true,
	authenticatedAt: true,
	lastSeenAt: true,
	expiresAt: true,
	revokedAt: true
});

export const managedPasskeyResponseSchema = z.object({
	id: uuidSchema,
	nickname: z.string().min(1).nullable(),
	deviceType: passkeyDeviceTypeSchema.nullable(),
	backedUp: z.boolean().nullable(),
	verifiedAt: dateSchema.nullable(),
	lastUsedAt: dateSchema.nullable()
});

export const authFlowStateResponseSchema = z.discriminatedUnion('status', [
	z.object({ status: z.literal('unauthenticated') }),
	z.object({ status: z.literal('authenticated') }),
	z.object({ status: z.literal('refresh_required') }),
	z.object({
		status: z.literal('mfa_required'),
		method: mfaMethodSchema,
		availableMethods: z.array(mfaMethodSchema)
	}),
	z.object({
		status: z.literal('mfa_setup_required'),
		availableMethods: z.array(mfaMethodSchema)
	})
]);

export const authResultResponseSchema = z.discriminatedUnion('status', [
	z.object({ status: z.literal('authenticated') }),
	z.object({
		status: z.literal('mfa_required'),
		method: mfaMethodSchema,
		availableMethods: z.array(mfaMethodSchema)
	}),
	z.object({
		status: z.literal('mfa_setup_required'),
		availableMethods: z.array(mfaMethodSchema)
	})
]);

export const passkeyOptionsResponseSchema = z.object({
	options: z.looseObject({ challenge: z.string().min(1) })
});

export const totpSetupResponseSchema = z.object({
	secret: z.string().min(1),
	otpauthUrl: z.url(),
	digits: z.number().int().min(6).max(8),
	period: z.number().int().min(15).max(120)
});

export const managedCategoryResponseSchema = productCategorySchema.extend({
	productCount: z.number().int().min(0).optional()
});

export const managedCategoryDetailResponseSchema = managedCategoryResponseSchema.extend({
	children: z.array(managedCategoryResponseSchema).optional()
});

export const managedProductImageResponseSchema = productImageSchema;

export const managedProductSkuResponseSchema = z.object({
	id: uuidSchema,
	productId: uuidSchema,
	productSlug: z.string().min(1),
	skuCode: z.string().min(1),
	name: z.string().min(1),
	nameEn: z.string().min(1).nullable(),
	description: z.string().min(1).nullable(),
	descriptionEn: z.string().min(1).nullable(),
	categoryId: uuidSchema.nullable(),
	categorySlug: z.string().min(1).nullable(),
	price: z.number().finite().min(0),
	stockQuantity: z.number().int().min(0),
	availability: z.enum(['in_stock', 'out_of_stock']),
	published: z.boolean(),
	attributes: attributeMapSchema,
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
	images: z.array(managedProductImageResponseSchema)
});

export const managedProductResponseSchema = z.object({
	id: uuidSchema,
	slug: z.string().min(1),
	name: z.string().min(1),
	nameEn: z.string().min(1).nullable(),
	description: z.string().min(1).nullable(),
	descriptionEn: z.string().min(1).nullable(),
	categoryId: uuidSchema.nullable(),
	categorySlug: z.string().min(1).nullable(),
	published: z.boolean(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
	thumbnail: managedProductImageResponseSchema.nullable(),
	images: z.array(managedProductImageResponseSchema),
	skus: z.array(managedProductSkuResponseSchema)
});

export const managedStaffResponseSchema = z.object({
	id: uuidSchema,
	email: z.email(),
	name: z.string().min(1),
	status: staffStatusSchema,
	preferredMfaMethod: mfaMethodSchema.nullable(),
	lastLoginAt: dateSchema.nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
	roles: z.array(managedRoleResponseSchema)
});

export const managedBusinessLabelResponseSchema = businessLabelSchema;
export const managedBusinessResponseSchema = businessSchema.extend({
	label: managedBusinessLabelResponseSchema.nullable()
});

export const managedOrderItemResponseSchema = orderItemSchema;
export const managedOrderResponseSchema = orderSchema.extend({
	business: managedBusinessResponseSchema.nullable(),
	items: z.array(managedOrderItemResponseSchema)
});

export const managedOrderSkuLookupResponseSchema = z.object({
	id: uuidSchema,
	skuCode: z.string().min(1),
	productName: z.string().min(1),
	price: z.number().finite().min(0),
	attributes: attributeMapSchema
});

export const managedLogResponseSchema = logSchema;

export const dashboardRangeResponseSchema = z.enum(['days', 'months', 'quarters']);
export const dashboardMetricResponseSchema = z.object({
	key: z.enum(['completedSales', 'completedOrders', 'businessSalesShare']),
	value: z.number().finite(),
	comparison: z.number().finite(),
	comparisonKind: z.enum(['percent', 'percentagePoint']),
	reference: z.literal('previousMonth')
});
export const dashboardTrendPointResponseSchema = z.object({
	startAt: dateSchema,
	label: z.string().min(1),
	value: z.number().finite()
});
export const dashboardTrendSeriesResponseSchema = z.object({
	key: z.enum(['total', 'business', 'consumer']),
	points: z.array(dashboardTrendPointResponseSchema)
});
export const dashboardResponseSchema = z.object({
	metrics: z.array(dashboardMetricResponseSchema),
	trend: z.object({
		range: dashboardRangeResponseSchema,
		series: z.array(dashboardTrendSeriesResponseSchema)
	}),
	topProducts: z.array(
		z.object({
			name: z.string().min(1),
			value: z.number().finite(),
			share: z.number().finite()
		})
	)
});

export const categoryDeleteResponseSchema = z.object({
	deleted: z.literal(true),
	mode: z.literal('soft'),
	productDisposition: z.enum(['none', 'uncategorize', 'reassign']),
	childDisposition: z.enum(['none', 'promote'])
});
export const categoryReorderResponseSchema = z.object({ reordered: z.literal(true) });
export const imageUploadTargetResponseSchema = z.object({
	uploadId: uuidSchema,
	uploadUrl: z.url(),
	assetKey: z.string().min(1),
	expiresAt: dateSchema
});
export const imageDeleteResponseSchema = z.object({
	deleted: z.boolean(),
	mode: z.enum(['soft', 'force']),
	assetDeleted: z.boolean()
});
export const countResponseSchema = z.object({
	updatedCount: z.number().int().min(0)
});
export const revokedCountResponseSchema = z.object({
	revokedCount: z.number().int().min(0)
});
export const initialPasswordResponseSchema = z.object({
	initialPassword: z.string().min(17)
});
export const staffCreatedResponseSchema = z.object({
	staff: managedStaffResponseSchema,
	initialPassword: z.string().min(17)
});
export const dataResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
	z.object({ data: z.array(itemSchema) });

const storefrontImageDates = {
	deletedAt: serializedDateSchema.nullable(),
	createdAt: serializedDateSchema,
	updatedAt: serializedDateSchema
};

export const storefrontImageResponseSchema = productImageSchema.extend(storefrontImageDates);

export const storefrontSkuResponseSchema = z.object({
	id: uuidSchema,
	productId: uuidSchema,
	productSlug: z.string().min(1),
	skuCode: z.string().min(1),
	name: z.string().min(1),
	nameEn: z.string().min(1).nullable(),
	description: z.string().min(1).nullable(),
	descriptionEn: z.string().min(1).nullable(),
	categoryId: uuidSchema.nullable(),
	categorySlug: z.string().min(1).nullable(),
	price: z.number().finite().min(0),
	availability: z.enum(['in_stock', 'out_of_stock']),
	published: z.boolean(),
	attributes: attributeMapSchema,
	deletedAt: serializedDateSchema.nullable(),
	createdAt: serializedDateSchema,
	updatedAt: serializedDateSchema,
	images: z.array(storefrontImageResponseSchema)
});

export const storefrontProductResponseSchema = z.object({
	id: uuidSchema,
	slug: z.string().min(1),
	name: z.string().min(1),
	nameEn: z.string().min(1).nullable(),
	description: z.string().min(1).nullable(),
	descriptionEn: z.string().min(1).nullable(),
	categoryId: uuidSchema.nullable(),
	categorySlug: z.string().min(1).nullable(),
	published: z.boolean(),
	deletedAt: serializedDateSchema.nullable(),
	createdAt: serializedDateSchema,
	updatedAt: serializedDateSchema,
	thumbnail: storefrontImageResponseSchema.nullable(),
	images: z.array(storefrontImageResponseSchema),
	skus: z.array(storefrontSkuResponseSchema)
});

export const storefrontCategoryResponseSchema = productCategorySchema.extend({
	deletedAt: serializedDateSchema.nullable(),
	createdAt: serializedDateSchema,
	updatedAt: serializedDateSchema,
	productCount: z.number().int().min(0).optional()
});

export type StorefrontCategoryNodeResponse = z.output<typeof storefrontCategoryResponseSchema> & {
	children: StorefrontCategoryNodeResponse[];
};

export const storefrontCategoryTreeResponseSchema: z.ZodType<StorefrontCategoryNodeResponse> =
	z.lazy(() =>
		storefrontCategoryResponseSchema.extend({
			children: z.array(storefrontCategoryTreeResponseSchema)
		})
	);

export const storefrontProductListResponseSchema = paginatedResponseSchema(
	storefrontProductResponseSchema
);
export const storefrontCategoryTreeListResponseSchema = dataResponseSchema(
	storefrontCategoryTreeResponseSchema
);
export const storefrontCategoryListResponseSchema = dataResponseSchema(
	storefrontCategoryResponseSchema
);

export const jsonMetadataResponseSchema = jsonValueSchema;
export const productImagePlacementResponseSchema = productImagePlacementSchema;
