import { z } from 'zod';

import {
	attributeMapSchema,
	booleanLikeSchema,
	dateSchema,
	moneySchema,
	nonEmptyUpdate,
	paginationQuerySchema,
	resourceSlugSchema,
	searchQuerySchema,
	sortOrderSchema,
	uuidSchema
} from './common.js';

export const productImagePlacementValues = ['thumbnail', 'shared-gallery', 'sku-gallery'] as const;

export const productImagePlacementSchema = z.enum(productImagePlacementValues);

export const productImageContentTypeValues = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/avif'
] as const;

export const productImageContentTypeSchema = z.enum(productImageContentTypeValues);
export const productImageMaxFileSize = 10 * 1024 * 1024;
const productImageFocusCoordinateSchema = z.number().min(0).max(1);
const productImageZoomSchema = z.number().min(1).max(3);
const maximumDatabaseInteger = 2_147_483_647;
const productNameSchema = z.string().trim().min(1).max(200);
const productDescriptionSchema = z.string().trim().min(1).max(10_000);
const skuCodeSchema = z.string().trim().min(1).max(120);
const imageAltTextSchema = z.string().trim().min(1).max(500);

const parsedAttributeQuerySchema = z
	.string()
	.max(8_192)
	.transform((value, context) => {
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
	name: productNameSchema,
	nameEn: productNameSchema.nullable(),
	slug: resourceSlugSchema,
	description: productDescriptionSchema.nullable(),
	descriptionEn: productDescriptionSchema.nullable(),
	position: z.number().int().min(0).max(maximumDatabaseInteger),
	parentId: uuidSchema.nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const productSchema = z.object({
	id: uuidSchema,
	slug: resourceSlugSchema,
	name: productNameSchema,
	nameEn: productNameSchema.nullable(),
	description: productDescriptionSchema.nullable(),
	descriptionEn: productDescriptionSchema.nullable(),
	categoryId: uuidSchema.nullable(),
	published: z.boolean(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const productImageSchema = z.object({
	id: uuidSchema,
	productId: uuidSchema,
	skuId: uuidSchema.nullable(),
	imageUrl: z.url(),
	assetKey: z.string().min(1).max(1_024).nullable(),
	altText: imageAltTextSchema,
	placement: productImagePlacementSchema,
	position: z.number().int().min(0).max(maximumDatabaseInteger),
	focusX: productImageFocusCoordinateSchema.nullable(),
	focusY: productImageFocusCoordinateSchema.nullable(),
	zoom: productImageZoomSchema.nullable(),
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema
});

export const productSkuSchema = z.object({
	id: uuidSchema,
	productId: uuidSchema,
	skuCode: skuCodeSchema,
	price: moneySchema,
	stockQuantity: z.number().int().min(0).max(maximumDatabaseInteger),
	attributes: attributeMapSchema,
	deletedAt: dateSchema.nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
	product: productSchema.optional(),
	images: z.array(productImageSchema).default([])
});

export const managementSkuListQuerySchema = paginationQuerySchema.extend({
	search: searchQuerySchema.optional(),
	published: booleanLikeSchema.optional(),
	categoryId: uuidSchema.optional(),
	sort: z.enum(['createdAt', 'updatedAt', 'skuCode', 'price']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const managementProductListQuerySchema = paginationQuerySchema.extend({
	search: searchQuerySchema.optional(),
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
	skuCode: skuCodeSchema,
	price: moneySchema,
	stockQuantity: z.coerce.number().int().min(0).max(maximumDatabaseInteger),
	attributes: attributeMapSchema.default({})
});

export const productCreateSchema = z.object({
	slug: resourceSlugSchema,
	name: productNameSchema,
	nameEn: productNameSchema.optional(),
	description: productDescriptionSchema.optional(),
	descriptionEn: productDescriptionSchema.optional(),
	categoryId: uuidSchema.nullable().optional(),
	published: booleanLikeSchema.default(false)
});

export const productSkuUpdateSchema = nonEmptyUpdate(
	z.object({
		productId: uuidSchema.optional(),
		skuCode: skuCodeSchema.optional(),
		price: moneySchema.optional(),
		stockQuantity: z.coerce.number().int().min(0).max(maximumDatabaseInteger).optional(),
		attributes: attributeMapSchema.optional()
	})
);

export const productUpdateSchema = nonEmptyUpdate(
	z.object({
		slug: resourceSlugSchema.optional(),
		name: productNameSchema.optional(),
		nameEn: productNameSchema.nullable().optional(),
		description: productDescriptionSchema.nullable().optional(),
		descriptionEn: productDescriptionSchema.nullable().optional(),
		categoryId: uuidSchema.nullable().optional(),
		published: booleanLikeSchema.optional()
	})
);

export const productBulkUpdateSchema = z.object({
	productIds: z
		.array(uuidSchema)
		.min(1)
		.max(100)
		.refine((productIds) => new Set(productIds).size === productIds.length),
	action: z.enum(['archive', 'restore', 'publish', 'unpublish'])
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
	search: searchQuerySchema.optional(),
	parentId: uuidSchema.optional(),
	includeTree: booleanLikeSchema.default(false),
	sort: z.enum(['name', 'createdAt', 'updatedAt', 'position']).default('position'),
	order: sortOrderSchema.default('asc')
});

export const productCategoryCreateSchema = z.object({
	name: productNameSchema,
	nameEn: productNameSchema.optional(),
	slug: resourceSlugSchema,
	parentId: uuidSchema.optional(),
	description: productDescriptionSchema.optional(),
	descriptionEn: productDescriptionSchema.optional(),
	position: z.coerce.number().int().min(0).max(maximumDatabaseInteger).default(0)
});

export const productCategoryUpdateSchema = nonEmptyUpdate(
	z.object({
		name: productNameSchema.optional(),
		nameEn: productNameSchema.nullable().optional(),
		slug: resourceSlugSchema.optional(),
		parentId: uuidSchema.nullable().optional(),
		description: productDescriptionSchema.nullable().optional(),
		descriptionEn: productDescriptionSchema.nullable().optional(),
		position: z.coerce.number().int().min(0).max(maximumDatabaseInteger).optional()
	})
);

export const productCategoryReorderSchema = z
	.object({
		parentId: uuidSchema.nullable(),
		categoryIds: z.array(uuidSchema).max(1000)
	})
	.superRefine((input, context) => {
		if (new Set(input.categoryIds).size !== input.categoryIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['categoryIds'],
				message: 'categoryIds must not contain duplicates.'
			});
		}
	});

export const productCategoryDeleteQuerySchema = z
	.object({
		productDisposition: z.enum(['reject', 'uncategorize', 'reassign']).default('reject'),
		childDisposition: z.enum(['reject', 'promote']).default('reject'),
		reassignToCategoryId: uuidSchema.optional()
	})
	.superRefine((input, context) => {
		if (input.productDisposition === 'reassign' && !input.reassignToCategoryId) {
			context.addIssue({
				code: 'custom',
				path: ['reassignToCategoryId'],
				message: 'reassignToCategoryId is required when productDisposition is reassign.'
			});
		}

		if (input.productDisposition !== 'reassign' && input.reassignToCategoryId) {
			context.addIssue({
				code: 'custom',
				path: ['reassignToCategoryId'],
				message: 'reassignToCategoryId is only allowed when productDisposition is reassign.'
			});
		}
	});

export const productCategoryDetailQuerySchema = z.object({
	includeChildren: booleanLikeSchema.default(false),
	includeProductCount: booleanLikeSchema.default(false)
});

export const managementProductImageListQuerySchema = paginationQuerySchema.extend({
	placement: productImagePlacementSchema.optional(),
	state: z.enum(['active', 'deleted']).default('active'),
	sort: z.enum(['position', 'createdAt', 'updatedAt']).default('position'),
	order: sortOrderSchema.default('asc')
});

export const productImageUploadRequestSchema = z.object({
	fileName: z.string().trim().min(1).max(255),
	contentType: productImageContentTypeSchema,
	fileSize: z.coerce.number().int().positive().max(productImageMaxFileSize)
});

export const productImageCreateSchema = z
	.object({
		uploadId: uuidSchema,
		altText: imageAltTextSchema,
		placement: productImagePlacementSchema.default('shared-gallery'),
		skuId: uuidSchema.nullish(),
		focusX: productImageFocusCoordinateSchema.nullish(),
		focusY: productImageFocusCoordinateSchema.nullish(),
		zoom: productImageZoomSchema.nullish()
	})
	.superRefine((input, context) => {
		const cropFieldCount = [input.focusX, input.focusY, input.zoom].filter(
			(value) => value !== undefined && value !== null
		).length;
		if (cropFieldCount !== 0 && cropFieldCount !== 3) {
			context.addIssue({
				code: 'custom',
				path: ['focusX'],
				message: 'focusX, focusY, and zoom must be provided together.'
			});
		}
		if (input.placement === 'sku-gallery' && !input.skuId) {
			context.addIssue({
				code: 'custom',
				path: ['skuId'],
				message: 'skuId is required for SKU gallery images.'
			});
		}
		if (input.placement !== 'sku-gallery' && input.skuId) {
			context.addIssue({
				code: 'custom',
				path: ['skuId'],
				message: 'skuId is only allowed for SKU gallery images.'
			});
		}
		if (input.placement !== 'thumbnail' && cropFieldCount !== 0) {
			context.addIssue({
				code: 'custom',
				path: ['focusX'],
				message: 'Only thumbnail images support crop positioning.'
			});
		}
	});

export const productImageCropUpdateSchema = z.object({
	focusX: productImageFocusCoordinateSchema,
	focusY: productImageFocusCoordinateSchema,
	zoom: productImageZoomSchema
});

export const productImageDeleteQuerySchema = z.object({
	force: booleanLikeSchema.default(false),
	deleteAsset: booleanLikeSchema.default(false)
});

export const storefrontSkuListQuerySchema = paginationQuerySchema.extend({
	search: searchQuerySchema.optional(),
	categorySlug: resourceSlugSchema.optional(),
	minPrice: moneySchema.optional(),
	maxPrice: moneySchema.optional(),
	attributes: z.union([attributeMapSchema, parsedAttributeQuerySchema]).optional(),
	includeImages: booleanLikeSchema.default(false),
	sort: z.enum(['name', 'price', 'createdAt']).default('createdAt'),
	order: sortOrderSchema.default('desc')
});

export const storefrontProductListQuerySchema = paginationQuerySchema.extend({
	search: searchQuerySchema.optional(),
	categorySlug: resourceSlugSchema.optional(),
	includeSkus: booleanLikeSchema.default(false),
	includeImages: booleanLikeSchema.default(false),
	sort: z.enum(['name', 'createdAt', 'minPrice']).default('createdAt'),
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
	parentSlug: resourceSlugSchema.optional(),
	includeTree: booleanLikeSchema.default(false),
	includeProductCount: booleanLikeSchema.default(false)
});

export const storefrontCategoryDetailQuerySchema = z.object({
	includeChildren: booleanLikeSchema.default(false),
	includeProductCount: booleanLikeSchema.default(false)
});
