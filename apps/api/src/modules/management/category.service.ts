import { AppError } from '../../errors/app-error.js';

import type {
	CatalogCategoryDetailRecord,
	CatalogCategoryRecord,
	CatalogCategoryTreeRecord
} from '../../types/catalog.js';
import { buildCategoryTree } from '../../utils/catalog.js';
import type { CatalogRepository } from './catalog.repository.js';

type CategoryListQuery = {
	page: number;
	limit: number;
	search?: string;
	parentId?: string;
	includeTree: boolean;
	sort: 'name' | 'createdAt' | 'updatedAt' | 'position';
	order: 'asc' | 'desc';
};

type CategoryDetailQuery = {
	includeChildren: boolean;
	includeProductCount: boolean;
};

type CategoryServiceDependencies = {
	repository: Pick<
		CatalogRepository,
		| 'listCategories'
		| 'listChildCategories'
		| 'findCategoryById'
		| 'createCategory'
		| 'updateCategory'
		| 'reassignSkusToCategory'
		| 'softDeleteCategory'
		| 'forceDeleteCategory'
		| 'slugExists'
		| 'hasCircularParent'
		| 'countAssignedSkus'
		| 'hasChildCategories'
	>;
};

type CategoryListResult = {
	data: Array<CatalogCategoryRecord | CatalogCategoryTreeRecord>;
	total: number;
};

function ensureCategory(category: CatalogCategoryRecord | null): CatalogCategoryRecord {
	if (!category) {
		throw new AppError(
			404,
			'CATEGORY_NOT_FOUND',
			'The requested product category could not be found.'
		);
	}

	return category;
}

export function createCategoryService(dependencies: CategoryServiceDependencies) {
	return {
		async listCategories(query: CategoryListQuery): Promise<CategoryListResult> {
			if (!query.includeTree) {
				return dependencies.repository.listCategories(query);
			}

			const result = await dependencies.repository.listCategories(
				{
					search: query.search,
					parentId: query.parentId,
					sort: query.sort,
					order: query.order
				},
				{
					paginate: false
				}
			);

			return {
				data: buildCategoryTree(result.data),
				total: result.total
			};
		},

		async getCategory(
			categoryId: string,
			query: CategoryDetailQuery
		): Promise<CatalogCategoryDetailRecord> {
			const category = ensureCategory(await dependencies.repository.findCategoryById(categoryId));
			const detail: CatalogCategoryDetailRecord = { ...category };

			if (query.includeChildren) {
				detail.children = await dependencies.repository.listChildCategories(category.id);
			}

			if (query.includeProductCount) {
				detail.productCount = await dependencies.repository.countAssignedSkus(category.id);
			}

			return detail;
		},

		async createCategory(input: {
			name: string;
			nameEn?: string;
			slug: string;
			parentId?: string;
			description?: string;
			descriptionEn?: string;
			position: number;
		}): Promise<CatalogCategoryRecord> {
			if (await dependencies.repository.slugExists(input.slug)) {
				throw new AppError(
					409,
					'CATEGORY_SLUG_CONFLICT',
					'The provided category slug is already in use.'
				);
			}

			if (input.parentId) {
				ensureCategory(await dependencies.repository.findCategoryById(input.parentId));
			}

			return dependencies.repository.createCategory(input);
		},

		async updateCategory(
			categoryId: string,
			input: {
				name?: string;
				nameEn?: string | null;
				slug?: string;
				parentId?: string | null;
				description?: string | null;
				descriptionEn?: string | null;
				position?: number;
			}
		): Promise<CatalogCategoryRecord> {
			const existingCategory = ensureCategory(
				await dependencies.repository.findCategoryById(categoryId)
			);

			if (input.slug && input.slug !== existingCategory.slug) {
				if (await dependencies.repository.slugExists(input.slug, categoryId)) {
					throw new AppError(
						409,
						'CATEGORY_SLUG_CONFLICT',
						'The provided category slug is already in use.'
					);
				}
			}

			if (input.parentId !== undefined && input.parentId !== null) {
				ensureCategory(await dependencies.repository.findCategoryById(input.parentId));
			}

			const nextParentId = input.parentId ?? null;

			if (
				input.parentId !== undefined &&
				(await dependencies.repository.hasCircularParent({
					categoryId,
					parentId: nextParentId
				}))
			) {
				throw new AppError(
					409,
					'CATEGORY_HIERARCHY_CONFLICT',
					'Circular category hierarchy is not allowed.'
				);
			}

			return dependencies.repository.updateCategory(categoryId, input);
		},

		async deleteCategory(
			categoryId: string,
			input: {
				force: boolean;
				reassignToCategoryId?: string;
			}
		): Promise<'soft' | 'force'> {
			ensureCategory(await dependencies.repository.findCategoryById(categoryId));

			if (await dependencies.repository.hasChildCategories(categoryId)) {
				throw new AppError(
					409,
					'CATEGORY_HAS_CHILDREN',
					'The category cannot be deleted while child categories are assigned to it.'
				);
			}

			const assignedSkuCount = await dependencies.repository.countAssignedSkus(categoryId);

			if (assignedSkuCount > 0) {
				if (!input.reassignToCategoryId) {
					throw new AppError(
						409,
						'CATEGORY_HAS_SKUS',
						'Assigned SKUs must be reassigned before deleting this category.'
					);
				}

				if (input.reassignToCategoryId === categoryId) {
					throw new AppError(
						409,
						'CATEGORY_REASSIGN_CONFLICT',
						'The reassignment category must be different from the deleted category.'
					);
				}

				ensureCategory(await dependencies.repository.findCategoryById(input.reassignToCategoryId));
				await dependencies.repository.reassignSkusToCategory(
					categoryId,
					input.reassignToCategoryId
				);
			}

			if (input.force) {
				await dependencies.repository.forceDeleteCategory(categoryId);
				return 'force';
			}

			await dependencies.repository.softDeleteCategory(categoryId);
			return 'soft';
		}
	};
}

export type CategoryService = ReturnType<typeof createCategoryService>;
