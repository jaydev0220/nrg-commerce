import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
	countResponseSchema,
	managedProductResponseSchema,
	managedProductSkuResponseSchema,
	managementProductListQuerySchema,
	managementSkuListQuerySchema,
	paginatedResponseSchema,
	productBulkUpdateSchema,
	productCreateSchema,
	productSkuCreateSchema,
	productSkuDeleteQuerySchema,
	productSkuRestoreSchema,
	productSkuUpdateSchema,
	skuDeleteResponseSchema,
	productUpdateSchema
} from '@packages/schemas';
import { compareValues, paginate } from '../http/pagination.js';
import { conflict, notFound } from '../http/errors.js';
import { parseBody, parseQuery, sendJson } from '../http/validation.js';
import type { MockState } from '../state.js';
import { assertDomainHealthy, projectManagedProduct, projectManagedSku } from './shared.js';

function findProduct(state: MockState, productId: string) {
	return state.products.find((product) => product.id === productId) ?? notFound();
}

function ensureCategory(state: MockState, categoryId: string | null | undefined): void {
	if (!categoryId) return;
	const category = state.categories.find(
		(entry) => entry.id === categoryId && entry.deletedAt === null
	);
	if (!category) notFound('The selected product category could not be found.');
}

function ensureUniqueSlug(state: MockState, slug: string, productId?: string): void {
	if (state.products.some((product) => product.slug === slug && product.id !== productId)) {
		conflict('RESOURCE_CONFLICT', 'A product with this slug already exists.');
	}
}

function ensureUniqueSkuCode(state: MockState, skuCode: string, skuId?: string): void {
	if (state.skus.some((sku) => sku.skuCode === skuCode && sku.id !== skuId)) {
		conflict('RESOURCE_CONFLICT', 'A SKU with this code already exists.');
	}
}

export function createProductsRouter(state: MockState, publicOrigin: string): Router {
	const router = Router();

	router.get('/', (request, response) => {
		assertDomainHealthy(state, 'products');
		const query = parseQuery(request, managementProductListQuerySchema);
		const search = query.search?.toLocaleLowerCase();
		let products = state.products.filter((product) => {
			if (!query.includeDeleted && product.deletedAt) return false;
			if (query.archived !== undefined && Boolean(product.deletedAt) !== query.archived)
				return false;
			if (query.published !== undefined && product.published !== query.published) return false;
			if (query.categoryId && product.categoryId !== query.categoryId) return false;
			if (!search) return true;
			const skuCodes = state.skus
				.filter((sku) => sku.productId === product.id)
				.map((sku) => sku.skuCode);
			return [product.name, product.nameEn, product.slug, ...skuCodes]
				.filter((value): value is string => Boolean(value))
				.some((value) => value.toLocaleLowerCase().includes(search));
		});
		products = [...products].sort((left, right) =>
			compareValues(left[query.sort], right[query.sort], query.order)
		);
		const page = paginate(products, query);
		sendJson(response, paginatedResponseSchema(managedProductResponseSchema), {
			...page,
			data: page.data.map((product) =>
				projectManagedProduct(state, product, publicOrigin, {
					includeSkus: query.includeSkus,
					includeImages: query.includeImages
				})
			)
		});
	});

	router.post('/', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productCreateSchema);
		ensureCategory(state, input.categoryId);
		ensureUniqueSlug(state, input.slug);
		const now = new Date();
		const product = {
			id: randomUUID(),
			slug: input.slug,
			name: input.name,
			nameEn: input.nameEn ?? null,
			description: input.description ?? null,
			descriptionEn: input.descriptionEn ?? null,
			notes: input.notes ?? null,
			baseUnit: input.baseUnit ?? null,
			categoryId: input.categoryId ?? null,
			published: input.published,
			deletedAt: null,
			createdAt: now,
			updatedAt: now
		};
		state.products.push(product);
		sendJson(
			response,
			managedProductResponseSchema,
			projectManagedProduct(state, product, publicOrigin),
			201
		);
	});

	router.patch('/bulk', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productBulkUpdateSchema);
		let updatedCount = 0;
		const now = new Date();
		for (const productId of input.productIds) {
			const product = state.products.find((entry) => entry.id === productId);
			if (!product) continue;
			if (input.action === 'archive') product.deletedAt = now;
			if (input.action === 'restore') product.deletedAt = null;
			if (input.action === 'publish') product.published = true;
			if (input.action === 'unpublish') product.published = false;
			product.updatedAt = now;
			updatedCount += 1;
		}
		sendJson(response, countResponseSchema, { updatedCount });
	});

	router.get('/skus', (request, response) => {
		assertDomainHealthy(state, 'products');
		const query = parseQuery(request, managementSkuListQuerySchema);
		const search = query.search?.toLocaleLowerCase();
		let skus = state.skus.filter((sku) => {
			const product = state.products.find((entry) => entry.id === sku.productId);
			if (!product) return false;
			if (query.archived === true ? !sku.deletedAt : sku.deletedAt) return false;
			if (query.archived !== true && product.deletedAt) return false;
			if (query.published !== undefined && product.published !== query.published) return false;
			if (query.categoryId && product.categoryId !== query.categoryId) return false;
			if (!search) return true;
			return [sku.skuCode, product.name, product.nameEn]
				.filter((value): value is string => Boolean(value))
				.some((value) => value.toLocaleLowerCase().includes(search));
		});
		skus = [...skus].sort((left, right) =>
			compareValues(left[query.sort], right[query.sort], query.order)
		);
		const page = paginate(skus, query);
		sendJson(response, paginatedResponseSchema(managedProductSkuResponseSchema), {
			...page,
			data: page.data.map((sku) =>
				projectManagedSku(state, sku, publicOrigin, true, query.archived === true)
			)
		});
	});

	router.post('/skus', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productSkuCreateSchema);
		findProduct(state, input.productId);
		ensureUniqueSkuCode(state, input.skuCode);
		const now = new Date();
		const sku = {
			id: randomUUID(),
			productId: input.productId,
			skuCode: input.skuCode,
			price: input.price,
			stockQuantity: input.stockQuantity,
			attributes: input.attributes,
			notes: input.notes ?? null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now
		};
		state.skus.push(sku);
		sendJson(
			response,
			managedProductSkuResponseSchema,
			projectManagedSku(state, sku, publicOrigin),
			201
		);
	});

	router.patch('/skus/:skuId', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productSkuUpdateSchema);
		const sku = state.skus.find((entry) => entry.id === request.params['skuId']) ?? notFound();
		if (input.skuCode) ensureUniqueSkuCode(state, input.skuCode, sku.id);
		Object.assign(sku, input, { updatedAt: new Date() });
		sendJson(
			response,
			managedProductSkuResponseSchema,
			projectManagedSku(state, sku, publicOrigin)
		);
	});

	router.post('/skus/:skuId/restore', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productSkuRestoreSchema);
		const sku = state.skus.find((entry) => entry.id === request.params['skuId']) ?? notFound();
		if (!sku.deletedAt) conflict('SKU_NOT_DELETED', 'The product SKU is not archived.');
		const product = findProduct(state, input.productId);
		if (product.deletedAt) notFound('The destination product could not be found.');
		ensureUniqueSkuCode(state, input.skuCode, sku.id);
		Object.assign(sku, input, {
			notes: input.notes ?? null,
			deletedAt: null,
			updatedAt: new Date()
		});
		for (const image of state.images.filter((entry) => entry.skuId === sku.id)) {
			image.productId = input.productId;
			image.updatedAt = new Date();
		}
		sendJson(
			response,
			managedProductSkuResponseSchema,
			projectManagedSku(state, sku, publicOrigin)
		);
	});

	router.delete('/skus/:skuId', (request, response) => {
		assertDomainHealthy(state, 'products');
		const query = parseQuery(request, productSkuDeleteQuerySchema);
		const sku = state.skus.find((entry) => entry.id === request.params['skuId']) ?? notFound();
		if (query.force) {
			if (state.images.some((image) => image.skuId === sku.id)) {
				conflict(
					'SKU_DELETE_CONFLICT',
					'Force deleting a product SKU with assigned images is not allowed.'
				);
			}
			state.skus.splice(state.skus.indexOf(sku), 1);
			for (const order of state.orders) {
				for (const item of order.items) {
					if (item.productSkuId === sku.id) item.productSkuId = null;
				}
			}
			sendJson(response, skuDeleteResponseSchema, { deleted: true, mode: 'force' });
			return;
		}
		sku.deletedAt = new Date();
		sku.updatedAt = sku.deletedAt;
		sendJson(response, skuDeleteResponseSchema, { deleted: true, mode: 'soft' });
	});

	router.get('/:productId', (request, response) => {
		assertDomainHealthy(state, 'products');
		const product = findProduct(state, request.params['productId'] ?? '');
		const includeSkus = request.query['includeSkus'] === 'true';
		const includeImages = request.query['includeImages'] === 'true';
		sendJson(
			response,
			managedProductResponseSchema,
			projectManagedProduct(state, product, publicOrigin, { includeSkus, includeImages })
		);
	});

	router.patch('/:productId', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productUpdateSchema);
		const product = findProduct(state, request.params['productId'] ?? '');
		if (input.categoryId !== undefined) ensureCategory(state, input.categoryId);
		if (input.slug) ensureUniqueSlug(state, input.slug, product.id);
		Object.assign(product, input, { updatedAt: new Date() });
		sendJson(
			response,
			managedProductResponseSchema,
			projectManagedProduct(state, product, publicOrigin, {
				includeSkus: true,
				includeImages: true
			})
		);
	});

	router.delete('/:productId', (request, response) => {
		assertDomainHealthy(state, 'products');
		const product = findProduct(state, request.params['productId'] ?? '');
		product.deletedAt = new Date();
		product.updatedAt = product.deletedAt;
		response.status(204).end();
	});

	router.post('/:productId/restore', (request, response) => {
		assertDomainHealthy(state, 'products');
		const product = findProduct(state, request.params['productId'] ?? '');
		product.deletedAt = null;
		product.updatedAt = new Date();
		sendJson(
			response,
			managedProductResponseSchema,
			projectManagedProduct(state, product, publicOrigin, {
				includeSkus: true,
				includeImages: true
			})
		);
	});

	return router;
}
