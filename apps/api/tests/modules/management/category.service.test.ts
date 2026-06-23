import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createCategoryService } from '../../../src/modules/management/category.service.js';

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
			reassignSkusToCategory: async () => {
				throw new Error('not used');
			},
			softDeleteCategory: async () => {
				throw new Error('not used');
			},
			forceDeleteCategory: async () => {
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
			countAssignedSkus: async () => 0,
			hasChildCategories: async () => false
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
