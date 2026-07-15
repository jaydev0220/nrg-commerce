import { z } from 'zod';

import {
	attributeMapSchema,
	booleanLikeSchema,
	dateSchema,
	moneySchema,
	nonEmptyUpdate,
	paginationQuerySchema,
	sortOrderSchema,
	uuidSchema
} from './common.js';

export const productImageTypeValues = ['thumbnail', 'gallery'] as const;

export const productImageTypeSchema = z.enum(productImageTypeValues);

export const productImageContentTypeValues = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/avif'
] as const;

export const productImageContentTypeSchema = z.enum(productImageContentTypeValues);
export const productImageMaxFileSize = 10 * 1024 * 1024;
const productImageFocusCoordinateSchema = z.number().min(0).max(1);

const parsedAttributeQuerySchema = z.string().transform((value, context) => {
	try {
		return attributeMapSchema.parse(JSON.parse(value));
	} catch {
		context.addIssue({
			code: 'custom',
			message: 'attributes must be a valid JSON object.'
		});
		return z.NEVER;
	}
});

export const productCategorySchema = z.object({
	id: uuidSchema,
	name: z.string().min(1),
	nameEn: z.string().min(1).nullable(),
	slug: z.string().trim().min(1),
	description: z.string().min(1).nullable(),
	descriptionEn: z.string().min(1).nullable(),
	position: z.number().int().min(0),
	parentId: uuidSchema.nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const productSchema = z.object({
	id: uuidSchema,
	slug: z.string().trim().min(1),
	name: z.string().trim().min(1),
	nameEn: z.string().trim().min(1).nullable(),
	description: z.string().min(1).nullable(),
	descriptionEn: z.string().min(1).nullable(),
	categoryId: uuidSchema.nullable(),
	published: z.boolean(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const productImageSchema = z.object({
	id: uuidSchema,
	skuId: uuidSchema,
	imageUrl: z.url(),
	assetKey: z.string().min(1).nullable(),
	altText: z.string().min(1),
	type: productImageTypeSchema,
	position: z.number().int().min(0),
	focusX: productImageFocusCoordinateSchema.nullable(),
	focusY: productImageFocusCoordinateSchema.nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const productSkuSchema = z.object({
	id: uuidSchema,
	productId: uuidSchema,
	skuCode: z.string().trim().min(1),
	price: moneySchema,
	attributes: attributeMapSchema,
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
	product: productSchema.optional(),
	images: z.array(productImageSchema).default([])
});

export const managementSkuListQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional(),
	published: booleanLikeSchema.optional(),
	categoryId: uuidSchema.optional(),
	sort: z.enum(['createdAt', 'updatedAt', 'skuCode', 'price']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const managementProductListQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional(),
	published: booleanLikeSchema.optional(),
	categoryId: uuidSchema.optional(),
	sort: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
	order: sortOrderSchema.default('desc'),
	includeSkus: booleanLikeSchema.default(false),
	includeImages: booleanLikeSchema.default(false),
	includeDeleted: booleanLikeSchema.default(false),
	archived: booleanLikeSchema.optional()
});

export const productSkuCreateSchema = z.object({
	productId: uuidSchema,
	skuCode: z.string().trim().min(1),
	price: moneySchema,
	attributes: attributeMapSchema.default({})
});

export const productCreateSchema = z.object({
	slug: z.string().trim().min(1),
	name: z.string().trim().min(1),
	nameEn: z.string().trim().min(1).optional(),
	description: z.string().trim().min(1).optional(),
	descriptionEn: z.string().trim().min(1).optional(),
	categoryId: uuidSchema.nullable().optional(),
	published: booleanLikeSchema.default(false)
});

export const productSkuUpdateSchema = nonEmptyUpdate(
	z.object({
		productId: uuidSchema.optional(),
		skuCode: z.string().trim().min(1).optional(),
		price: moneySchema.optional(),
		attributes: attributeMapSchema.optional()
	})
);

export const productUpdateSchema = nonEmptyUpdate(
	z.object({
		slug: z.string().trim().min(1).optional(),
		name: z.string().trim().min(1).optional(),
		nameEn: z.string().trim().min(1).nullable().optional(),
		description: z.string().trim().min(1).nullable().optional(),
		descriptionEn: z.string().trim().min(1).nullable().optional(),
		categoryId: uuidSchema.nullable().optional(),
		published: booleanLikeSchema.optional()
	})
);

export const productBulkUpdateSchema = z.object({
	productIds: z.array(uuidSchema).min(1).max(100),
	action: z.enum(['archive', 'restore', 'publish', 'unpublish'])
});

export const productDeleteQuerySchema = z.object({
	force: booleanLikeSchema.default(false)
});

export const managementProductDetailQuerySchema = z.object({
	includeSkus: booleanLikeSchema.default(false),
	includeImages: booleanLikeSchema.default(false)
});

export const productSkuDeleteQuerySchema = z.object({
	force: booleanLikeSchema.default(false)
});

export const managementSkuDetailQuerySchema = z.object({
	includeImages: booleanLikeSchema.default(false)
});

export const managementCategoryListQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional(),
	parentId: uuidSchema.optional(),
	includeTree: booleanLikeSchema.default(false),
	sort: z.enum(['name', 'createdAt', 'updatedAt', 'position']).default('position'),
	order: sortOrderSchema.default('asc')
});

export const productCategoryCreateSchema = z.object({
	name: z.string().trim().min(1),
	nameEn: z.string().trim().min(1).optional(),
	slug: z.string().trim().min(1),
	parentId: uuidSchema.optional(),
	description: z.string().trim().min(1).optional(),
	descriptionEn: z.string().trim().min(1).optional(),
	position: z.coerce.number().int().min(0).default(0)
});

export const productCategoryUpdateSchema = nonEmptyUpdate(
	z.object({
		name: z.string().trim().min(1).optional(),
		nameEn: z.string().trim().min(1).nullable().optional(),
		slug: z.string().trim().min(1).optional(),
		parentId: uuidSchema.nullable().optional(),
		description: z.string().trim().min(1).nullable().optional(),
		descriptionEn: z.string().trim().min(1).nullable().optional(),
		position: z.coerce.number().int().min(0).optional()
	})
);

export const productCategoryDeleteQuerySchema = z.object({
	force: booleanLikeSchema.default(false),
	reassignToCategoryId: uuidSchema.optional()
});

export const productCategoryDetailQuerySchema = z.object({
	includeChildren: booleanLikeSchema.default(false),
	includeProductCount: booleanLikeSchema.default(false)
});

export const managementProductImageListQuerySchema = paginationQuerySchema.extend({
	type: productImageTypeSchema.optional(),
	state: z.enum(['active', 'deleted']).default('active'),
	sort: z.enum(['position', 'createdAt', 'updatedAt']).default('position'),
	order: sortOrderSchema.default('asc')
});

export const productImageUploadRequestSchema = z.object({
	fileName: z.string().trim().min(1),
	contentType: productImageContentTypeSchema,
	fileSize: z.coerce.number().int().positive().max(productImageMaxFileSize)
});

export const productImageCreateSchema = z
	.object({
		uploadId: uuidSchema,
		altText: z.string().trim().min(1),
		type: productImageTypeSchema.default('gallery'),
		focusX: productImageFocusCoordinateSchema.nullish(),
		focusY: productImageFocusCoordinateSchema.nullish()
	})
	.superRefine((input, context) => {
		if ((input.focusX === undefined) !== (input.focusY === undefined)) {
			context.addIssue({
				code: 'custom',
				path: ['focusX'],
				message: 'focusX and focusY must be provided together.'
			});
		}
	});

export const productImageFocusUpdateSchema = z.object({
	focusX: productImageFocusCoordinateSchema,
	focusY: productImageFocusCoordinateSchema
});

export const productImageDeleteQuerySchema = z.object({
	force: booleanLikeSchema.default(false),
	deleteAsset: booleanLikeSchema.default(false)
});

export const storefrontSkuListQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional(),
	categorySlug: z.string().trim().min(1).optional(),
	minPrice: moneySchema.optional(),
	maxPrice: moneySchema.optional(),
	attributes: z.union([attributeMapSchema, parsedAttributeQuerySchema]).optional(),
	includeImages: booleanLikeSchema.default(false),
	sort: z.enum(['name', 'price', 'createdAt']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const storefrontProductListQuerySchema = paginationQuerySchema.extend({
	search: z.string().trim().min(1).optional(),
	categorySlug: z.string().trim().min(1).optional(),
	includeSkus: booleanLikeSchema.default(false),
	includeImages: booleanLikeSchema.default(false),
	sort: z.enum(['name', 'createdAt']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const storefrontSkuDetailQuerySchema = z.object({
	includeImages: booleanLikeSchema.default(false)
});

export const storefrontProductDetailQuerySchema = z.object({
	includeSkus: booleanLikeSchema.default(false),
	includeImages: booleanLikeSchema.default(false)
});

export const storefrontCategoryListQuerySchema = z.object({
	parentSlug: z.string().trim().min(1).optional(),
	includeTree: booleanLikeSchema.default(false),
	includeProductCount: booleanLikeSchema.default(false)
});

export const storefrontCategoryDetailQuerySchema = z.object({
	includeChildren: booleanLikeSchema.default(false),
	includeProductCount: booleanLikeSchema.default(false)
});
