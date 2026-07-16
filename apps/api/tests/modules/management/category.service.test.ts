import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createCategoryService } from '../../../src/modules/management/category/category.service.js';
import type { CatalogCategoryRecord } from '../../../src/types/catalog.js';

type CategoryRepository = Parameters<typeof createCategoryService>[0]['repository'];

function createCategory(id = 'category-1', parentId: string | null = null): CatalogCategoryRecord {
	const now = new Date();
	return {
		id,
		name: 'Category',
		nameEn: 'Category',
		slug: id,
		description: null,
		descriptionEn: null,
		position: 0,
		parentId,
		deletedAt: null,
		createdAt: now,
		updatedAt: now
	};
}

function createRepository(overrides: Partial<CategoryRepository> = {}): CategoryRepository {
	const category = createCategory();
	return {
		listCategories: async () => ({ data: [], total: 0 }),
		listChildCategories: async () => [],
		findCategoryById: async (categoryId: string) => (categoryId === category.id ? category : null),
		createCategory: async () => category,
		updateCategory: async () => category,
		reorderCategorySiblings: async () => true,
		deleteCategory: async () => 'deleted',
		slugExists: async () => false,
		hasCircularParent: async () => false,
		countAssignedSkus: async () => 0,
		...overrides
	};
}

test('updateCategory rejects circular category parent changes', async () => {
	const categoryService = createCategoryService({
		repository: {
			listCategories: async () => ({ data: [], total: 0 }),
			listChildCategories: async () => [],
			findCategoryById: async (categoryId: string) => {
				if (categoryId === 'category-1') {
					return {
						id: 'category-1',
						name: 'Parent',
						nameEn: 'Parent',
						slug: 'parent',
						description: null,
						descriptionEn: null,
						position: 0,
						parentId: null,
						deletedAt: null,
						createdAt: new Date(),
						updatedAt: new Date()
					};
				}

				if (categoryId === 'category-2') {
					return {
						id: 'category-2',
						name: 'Child',
						nameEn: 'Child',
						slug: 'child',
						description: null,
						descriptionEn: null,
						position: 0,
						parentId: 'category-1',
						deletedAt: null,
						createdAt: new Date(),
						updatedAt: new Date()
					};
				}

				return null;
			},
			createCategory: async () => {
				throw new Error('not used');
			},
			updateCategory: async () => {
				throw new Error('not used');
			},
			reorderCategorySiblings: async () => false,
			deleteCategory: async () => {
				throw new Error('not used');
			},
			slugExists: async () => false,
			hasCircularParent: async ({
				categoryId,
				parentId
			}: {
				categoryId: string;
				parentId: string | null;
			}) => categoryId === 'category-1' && parentId === 'category-2',
			countAssignedSkus: async () => 0
		}
	});

	await assert.rejects(
		() =>
			categoryService.updateCategory('category-1', {
				parentId: 'category-2'
			}),
		(error: unknown) => error instanceof AppError && error.statusCode === 409
	);
});

test('reorderCategories rejects stale sibling lists', async () => {
	const categoryService = createCategoryService({
		repository: createRepository({ reorderCategorySiblings: async () => false })
	});

	await assert.rejects(
		() =>
			categoryService.reorderCategories({
				parentId: null,
				categoryIds: ['category-1']
			}),
		(error: unknown) =>
			error instanceof AppError &&
			error.statusCode === 409 &&
			error.code === 'CATEGORY_REORDER_CONFLICT'
	);
});

test('deleteCategory rejects assigned products when no disposition is provided', async () => {
	let deleteCalled = false;
	const categoryService = createCategoryService({
		repository: createRepository({
			countAssignedSkus: async () => 2,
			deleteCategory: async () => {
				deleteCalled = true;
				return 'deleted';
			}
		})
	});

	await assert.rejects(
		() =>
			categoryService.deleteCategory('category-1', {
				productDisposition: 'reject',
				childDisposition: 'promote'
			}),
		(error: unknown) =>
			error instanceof AppError &&
			error.statusCode === 409 &&
			error.code === 'CATEGORY_HAS_PRODUCTS'
	);
	assert.equal(deleteCalled, false);
});

test('deleteCategory uncategorizes products and promotes children atomically', async () => {
	let deletionInput: Parameters<CategoryRepository['deleteCategory']>[1] | undefined;
	const categoryService = createCategoryService({
		repository: createRepository({
			countAssignedSkus: async () => 2,
			deleteCategory: async (_categoryId, input) => {
				deletionInput = input;
				return 'deleted';
			}
		})
	});

	const result = await categoryService.deleteCategory('category-1', {
		productDisposition: 'uncategorize',
		childDisposition: 'promote'
	});

	assert.deepEqual(result, {
		mode: 'soft',
		productDisposition: 'uncategorize',
		childDisposition: 'promote'
	});
	assert.deepEqual(deletionInput, {
		productDisposition: 'uncategorize',
		childDisposition: 'promote',
		reassignToCategoryId: undefined
	});
});

test('deleteCategory requires and validates a reassignment category', async () => {
	const categoryService = createCategoryService({
		repository: createRepository({ countAssignedSkus: async () => 1 })
	});

	await assert.rejects(
		() =>
			categoryService.deleteCategory('category-1', {
				productDisposition: 'reassign',
				childDisposition: 'promote'
			}),
		(error: unknown) => error instanceof AppError && error.code === 'CATEGORY_REASSIGN_CONFLICT'
	);

	await assert.rejects(
		() =>
			categoryService.deleteCategory('category-1', {
				productDisposition: 'reassign',
				childDisposition: 'promote',
				reassignToCategoryId: 'category-1'
			}),
		(error: unknown) => error instanceof AppError && error.code === 'CATEGORY_REASSIGN_CONFLICT'
	);

	await assert.rejects(
		() =>
			categoryService.deleteCategory('category-1', {
				productDisposition: 'reassign',
				childDisposition: 'promote',
				reassignToCategoryId: 'category-2'
			}),
		(error: unknown) => error instanceof AppError && error.code === 'CATEGORY_NOT_FOUND'
	);
});

test('deleteCategory maps repository child conflicts', async () => {
	const categoryService = createCategoryService({
		repository: createRepository({ deleteCategory: async () => 'has_children' })
	});

	await assert.rejects(
		() =>
			categoryService.deleteCategory('category-1', {
				productDisposition: 'reject',
				childDisposition: 'reject'
			}),
		(error: unknown) =>
			error instanceof AppError &&
			error.statusCode === 409 &&
			error.code === 'CATEGORY_HAS_CHILDREN'
	);
});
