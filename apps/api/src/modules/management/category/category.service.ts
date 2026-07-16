import { AppError } from '../../../errors/app-error.js';

import type {
	CatalogCategoryDetailRecord,
	CatalogCategoryRecord,
	CatalogCategoryTreeRecord
} from '../../../types/catalog.js';
import { buildCategoryTree } from '../../../utils/catalog.js';
import type { CatalogRepository } from '../catalog.repository.js';

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
		| 'reorderCategorySiblings'
		| 'deleteCategory'
		| 'slugExists'
		| 'hasCircularParent'
		| 'countAssignedSkus'
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

		async reorderCategories(input: {
			parentId: string | null;
			categoryIds: string[];
		}): Promise<void> {
			const reordered = await dependencies.repository.reorderCategorySiblings(input);
			if (!reordered) {
				throw new AppError(
					409,
					'CATEGORY_REORDER_CONFLICT',
					'The category list changed before the reorder could be saved.'
				);
			}
		},

		async deleteCategory(
			categoryId: string,
			input: {
				productDisposition: 'reject' | 'uncategorize' | 'reassign';
				childDisposition: 'reject' | 'promote';
				reassignToCategoryId?: string;
			}
		): Promise<{
			mode: 'soft';
			productDisposition: 'none' | 'uncategorize' | 'reassign';
			childDisposition: 'none' | 'promote';
		}> {
			ensureCategory(await dependencies.repository.findCategoryById(categoryId));
			const assignedSkuCount = await dependencies.repository.countAssignedSkus(categoryId);
			const productDisposition =
				assignedSkuCount === 0
					? 'none'
					: input.productDisposition === 'uncategorize'
						? 'uncategorize'
						: input.productDisposition === 'reassign'
							? 'reassign'
							: 'none';

			if (productDisposition === 'none' && assignedSkuCount > 0) {
				throw new AppError(
					409,
					'CATEGORY_HAS_PRODUCTS',
					'Products assigned to this category must be reassigned or uncategorized before deletion.'
				);
			}

			if (productDisposition === 'reassign') {
				if (!input.reassignToCategoryId || input.reassignToCategoryId === categoryId) {
					throw new AppError(
						409,
						'CATEGORY_REASSIGN_CONFLICT',
						'The reassignment category must be different from the deleted category.'
					);
				}
				ensureCategory(await dependencies.repository.findCategoryById(input.reassignToCategoryId));
			}

			const childDisposition = input.childDisposition === 'promote' ? 'promote' : 'none';
			const result = await dependencies.repository.deleteCategory(categoryId, {
				productDisposition,
				childDisposition,
				reassignToCategoryId: input.reassignToCategoryId
			});

			if (result === 'not_found') {
				throw new AppError(
					404,
					'CATEGORY_NOT_FOUND',
					'The requested product category could not be found.'
				);
			}
			if (result === 'has_children') {
				throw new AppError(
					409,
					'CATEGORY_HAS_CHILDREN',
					'The category cannot be deleted while child categories are assigned to it.'
				);
			}
			if (result === 'has_products') {
				throw new AppError(
					409,
					'CATEGORY_HAS_PRODUCTS',
					'Products assigned to this category must be reassigned or uncategorized before deletion.'
				);
			}

			return {
				mode: 'soft',
				productDisposition,
				childDisposition
			};
		}
	};
}

export type CategoryService = ReturnType<typeof createCategoryService>;
