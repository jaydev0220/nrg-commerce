import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';

import {
	paginatedResponseSchema,
	storefrontCategoryTreeListResponseSchema,
	storefrontProductListResponseSchema
} from '../src/responses.js';

const productId = '0189076c-4f2a-7fe1-b9fd-2d68df455111';
const skuId = '0189076c-4f2a-7fe1-b9fd-2d68df455112';
const imageId = '0189076c-4f2a-7fe1-b9fd-2d68df455113';
const categoryId = '0189076c-4f2a-7fe1-b9fd-2d68df455114';
const createdAt = '2026-07-22T03:00:00.000Z';
const updatedAt = '2026-07-22T03:10:00.000Z';

const image = {
	id: imageId,
	productId,
	skuId,
	imageUrl: 'https://cdn.example.com/products/image.webp',
	assetKey: 'products/image.webp',
	altText: 'Product image',
	placement: 'sku-gallery',
	position: 0,
	focusX: 0.5,
	focusY: 0.5,
	zoom: 1,
	deletedAt: null,
	createdAt,
	updatedAt
};

test('creates strict paginated response contracts', () => {
	const schema = paginatedResponseSchema(z.string());

	assert.deepEqual(
		schema.parse({
			data: ['one'],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
		}),
		{
			data: ['one'],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
		}
	);
	assert.equal(
		schema.safeParse({
			data: [1],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
		}).success,
		false
	);
});

test('validates serialized storefront products without reviving dates', () => {
	const parsed = storefrontProductListResponseSchema.parse({
		data: [
			{
				id: productId,
				slug: 'product',
				name: 'Product',
				nameEn: 'Product',
				description: 'Description',
				descriptionEn: 'Description',
				categoryId,
				categorySlug: 'category',
				published: true,
				deletedAt: null,
				createdAt,
				updatedAt,
				thumbnail: { ...image, skuId: null, placement: 'thumbnail' },
				images: [image],
				skus: [
					{
						id: skuId,
						productId,
						productSlug: 'product',
						skuCode: 'SKU-1',
						name: 'Product',
						nameEn: 'Product',
						description: 'Description',
						descriptionEn: 'Description',
						categoryId,
						categorySlug: 'category',
						price: 10,
						availability: 'in_stock',
						published: true,
						attributes: { color: 'red' },
						deletedAt: null,
						createdAt,
						updatedAt,
						images: [image]
					}
				]
			}
		],
		pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
	});

	assert.equal(parsed.data[0]?.updatedAt, updatedAt);
	assert.equal(parsed.data[0]?.skus[0]?.images[0]?.createdAt, createdAt);
});

test('validates recursive category trees', () => {
	const category = {
		id: categoryId,
		name: 'Category',
		nameEn: 'Category',
		slug: 'category',
		description: null,
		descriptionEn: null,
		position: 0,
		parentId: null,
		deletedAt: null,
		createdAt,
		updatedAt,
		productCount: 1
	};
	const parsed = storefrontCategoryTreeListResponseSchema.parse({
		data: [
			{
				...category,
				children: [{ ...category, id: productId, parentId: categoryId, children: [] }]
			}
		]
	});

	assert.equal(parsed.data[0]?.children[0]?.parentId, categoryId);
});
