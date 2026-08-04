import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
	categoryDeleteResponseSchema,
	categoryReorderResponseSchema,
	managedCategoryDetailResponseSchema,
	managedCategoryResponseSchema,
	managementCategoryListQuerySchema,
	paginatedResponseSchema,
	productCategoryCreateSchema,
	productCategoryDeleteQuerySchema,
	productCategoryDetailQuerySchema,
	productCategoryReorderSchema,
	productCategoryUpdateSchema
} from '@packages/schemas';
import { conflict, MockHttpError, notFound } from '../http/errors.js';
import { compareValues, paginate } from '../http/pagination.js';
import { parseBody, parseQuery, sendJson } from '../http/validation.js';
import type { MockCategory, MockState } from '../state.js';
import { assertDomainHealthy, categoryProductCount } from './shared.js';

function findCategory(state: MockState, categoryId: string): MockCategory {
	return state.categories.find((category) => category.id === categoryId) ?? notFound();
}

function ensureUniqueSlug(state: MockState, slug: string, categoryId?: string): void {
	if (state.categories.some((category) => category.slug === slug && category.id !== categoryId)) {
		conflict('RESOURCE_CONFLICT', 'A category with this slug already exists.');
	}
}

function ensureValidParent(
	state: MockState,
	category: MockCategory | null,
	parentId: string | null
): void {
	if (!parentId) return;
	const parent = state.categories.find(
		(entry) => entry.id === parentId && entry.deletedAt === null
	);
	if (!parent) notFound('The selected parent category could not be found.');
	if (!category) return;
	if (parent.id === category.id) {
		throw new MockHttpError(409, 'RELATION_CONFLICT', 'A category cannot be its own parent.');
	}
	let ancestor: MockCategory | undefined = parent;
	while (ancestor?.parentId) {
		if (ancestor.parentId === category.id) {
			throw new MockHttpError(409, 'RELATION_CONFLICT', 'Category nesting would create a cycle.');
		}
		ancestor = state.categories.find((entry) => entry.id === ancestor?.parentId);
	}
}

function projectCategory(state: MockState, category: MockCategory, withCount = false) {
	return {
		...category,
		...(withCount ? { productCount: categoryProductCount(state, category.id) } : {})
	};
}

export function createCategoriesRouter(state: MockState): Router {
	const router = Router();

	router.get('/', (request, response) => {
		assertDomainHealthy(state, 'products');
		const query = parseQuery(request, managementCategoryListQuerySchema);
		const search = query.search?.toLocaleLowerCase();
		let categories = state.categories.filter((category) => {
			if (category.deletedAt) return false;
			if (query.parentId && category.parentId !== query.parentId) return false;
			if (!search) return true;
			return [category.name, category.nameEn, category.slug]
				.filter((value): value is string => Boolean(value))
				.some((value) => value.toLocaleLowerCase().includes(search));
		});
		categories = [...categories].sort((left, right) =>
			compareValues(left[query.sort], right[query.sort], query.order)
		);
		const page = paginate(categories, query);
		sendJson(response, paginatedResponseSchema(managedCategoryResponseSchema), {
			...page,
			data: page.data.map((category) => projectCategory(state, category, true))
		});
	});

	router.post('/', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productCategoryCreateSchema);
		ensureUniqueSlug(state, input.slug);
		ensureValidParent(state, null, input.parentId ?? null);
		const now = new Date();
		const category: MockCategory = {
			id: randomUUID(),
			name: input.name,
			nameEn: input.nameEn ?? null,
			slug: input.slug,
			description: input.description ?? null,
			descriptionEn: input.descriptionEn ?? null,
			position: input.position,
			parentId: input.parentId ?? null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now
		};
		state.categories.push(category);
		sendJson(response, managedCategoryResponseSchema, projectCategory(state, category, true), 201);
	});

	router.put('/reorder', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productCategoryReorderSchema);
		if (input.parentId) findCategory(state, input.parentId);
		const siblings = state.categories.filter(
			(category) => category.parentId === input.parentId && category.deletedAt === null
		);
		if (
			input.categoryIds.some(
				(categoryId) => !siblings.some((category) => category.id === categoryId)
			)
		) {
			throw new MockHttpError(
				409,
				'RELATION_CONFLICT',
				'Reorder list contains a category outside the selected parent.'
			);
		}
		for (const [position, categoryId] of input.categoryIds.entries()) {
			const category = findCategory(state, categoryId);
			category.position = position;
			category.updatedAt = new Date();
		}
		sendJson(response, categoryReorderResponseSchema, { reordered: true });
	});

	router.get('/:categoryId', (request, response) => {
		assertDomainHealthy(state, 'products');
		const query = parseQuery(request, productCategoryDetailQuerySchema);
		const category = findCategory(state, request.params['categoryId'] ?? '');
		const payload = {
			...projectCategory(state, category, query.includeProductCount),
			...(query.includeChildren
				? {
						children: state.categories
							.filter((child) => child.parentId === category.id && child.deletedAt === null)
							.sort((left, right) => left.position - right.position)
							.map((child) => projectCategory(state, child, query.includeProductCount))
					}
				: {})
		};
		sendJson(response, managedCategoryDetailResponseSchema, payload);
	});

	router.patch('/:categoryId', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productCategoryUpdateSchema);
		const category = findCategory(state, request.params['categoryId'] ?? '');
		if (input.slug) ensureUniqueSlug(state, input.slug, category.id);
		if (input.parentId !== undefined) ensureValidParent(state, category, input.parentId);
		Object.assign(category, input, { updatedAt: new Date() });
		sendJson(response, managedCategoryResponseSchema, projectCategory(state, category, true));
	});

	router.delete('/:categoryId', (request, response) => {
		assertDomainHealthy(state, 'products');
		const query = parseQuery(request, productCategoryDeleteQuerySchema);
		const category = findCategory(state, request.params['categoryId'] ?? '');
		const products = state.products.filter(
			(product) => product.categoryId === category.id && product.deletedAt === null
		);
		const children = state.categories.filter(
			(child) => child.parentId === category.id && child.deletedAt === null
		);
		if (products.length > 0 && query.productDisposition === 'reject') {
			throw new MockHttpError(409, 'RELATION_CONFLICT', 'Category still contains products.');
		}
		if (children.length > 0 && query.childDisposition === 'reject') {
			throw new MockHttpError(
				409,
				'RELATION_CONFLICT',
				'Category still contains child categories.'
			);
		}
		if (query.productDisposition === 'reassign') {
			const target = findCategory(state, query.reassignToCategoryId ?? '');
			if (target.deletedAt || target.id === category.id) {
				throw new MockHttpError(409, 'RELATION_CONFLICT', 'Invalid category reassignment target.');
			}
			for (const product of products) product.categoryId = target.id;
		}
		if (query.productDisposition === 'uncategorize') {
			for (const product of products) product.categoryId = null;
		}
		if (query.childDisposition === 'promote') {
			for (const child of children) child.parentId = category.parentId;
		}
		const now = new Date();
		category.deletedAt = now;
		category.updatedAt = now;
		sendJson(response, categoryDeleteResponseSchema, {
			deleted: true,
			mode: 'soft',
			productDisposition:
				products.length === 0
					? 'none'
					: query.productDisposition === 'reassign'
						? 'reassign'
						: 'uncategorize',
			childDisposition: children.length === 0 ? 'none' : 'promote'
		});
	});

	return router;
}
