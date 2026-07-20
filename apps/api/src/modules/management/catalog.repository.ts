import type { DatabaseClient } from '@packages/database';

import type {
	CatalogCategoryRecord,
	CatalogImageRecord,
	CatalogJsonValue,
	CatalogProductRecord,
	CatalogSkuRecord,
	PaginatedResult
} from '../../types/catalog.js';

type CategorySortField = 'name' | 'createdAt' | 'updatedAt' | 'position';
type ProductSortField = 'name' | 'createdAt' | 'updatedAt';
type SkuSortField = 'createdAt' | 'updatedAt' | 'skuCode' | 'price';
type StorefrontSkuSortField = 'name' | 'price' | 'createdAt';
type ImageSortField = 'position' | 'createdAt' | 'updatedAt';

type ListCategoriesInput = {
	search?: string;
	parentId?: string;
	sort: CategorySortField;
	order: 'asc' | 'desc';
	page?: number;
	limit?: number;
};

type ListSkusInput = {
	search?: string;
	published?: boolean;
	categoryId?: string;
	categorySlug?: string;
	minPrice?: number;
	maxPrice?: number;
	sort: SkuSortField | StorefrontSkuSortField;
	order: 'asc' | 'desc';
	page?: number;
	limit?: number;
};

type ListProductsInput = {
	search?: string;
	published?: boolean;
	categoryId?: string;
	categorySlug?: string;
	sort: ProductSortField;
	order: 'asc' | 'desc';
	page?: number;
	limit?: number;
	includeDeleted?: boolean;
	archived?: boolean;
};

type FindProductOptions = {
	includeSkus: boolean;
	includeImages: boolean;
	publishedOnly?: boolean;
	includeDeleted?: boolean;
};

type FindSkuOptions = {
	includeImages: boolean;
	publishedOnly?: boolean;
};

type ListImagesInput = {
	placement?: 'thumbnail' | 'shared-gallery' | 'sku-gallery';
	state: 'active' | 'deleted';
	sort: ImageSortField;
	order: 'asc' | 'desc';
	page: number;
	limit: number;
};

type BulkProductUpdateInput = {
	productIds: string[];
	action: 'archive' | 'restore' | 'publish' | 'unpublish';
};

type ListCategoriesOptions = {
	paginate?: boolean;
};

type CategoryReorderInput = {
	parentId: string | null;
	categoryIds: string[];
};

type CategoryDeletionInput = {
	productDisposition: 'none' | 'uncategorize' | 'reassign';
	childDisposition: 'none' | 'promote';
	reassignToCategoryId?: string;
};

type CategoryDeletionStatus = 'deleted' | 'not_found' | 'has_children' | 'has_products';

type ListProductsOptions = {
	paginate?: boolean;
	includeSkus: boolean;
	includeImages: boolean;
	publishedOnly?: boolean;
};

type ListSkusOptions = {
	paginate?: boolean;
	includeImages: boolean;
	publishedOnly?: boolean;
};

function mapCategoryRecord(category: {
	id: string;
	name: string;
	nameEn: string | null;
	slug: string;
	description: string | null;
	descriptionEn: string | null;
	position: number;
	parentId: string | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}): CatalogCategoryRecord {
	return {
		id: category.id,
		name: category.name,
		nameEn: category.nameEn,
		slug: category.slug,
		description: category.description,
		descriptionEn: category.descriptionEn,
		position: category.position,
		parentId: category.parentId,
		deletedAt: category.deletedAt,
		createdAt: category.createdAt,
		updatedAt: category.updatedAt
	};
}

type RawImageRecord = {
	id: string;
	productId: string;
	skuId: string | null;
	imageUrl: string;
	assetKey: string | null;
	altText: string;
	position: number;
	focusX: number | null;
	focusY: number | null;
	zoom: number | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

function mapImageRecord(
	image: RawImageRecord,
	thumbnailImageId?: string | null
): CatalogImageRecord {
	return {
		id: image.id,
		productId: image.productId,
		skuId: image.skuId,
		imageUrl: image.imageUrl,
		assetKey: image.assetKey,
		altText: image.altText,
		placement:
			image.id === thumbnailImageId ? 'thumbnail' : image.skuId ? 'sku-gallery' : 'shared-gallery',
		position: image.position,
		focusX: image.focusX,
		focusY: image.focusY,
		zoom: image.zoom,
		deletedAt: image.deletedAt,
		createdAt: image.createdAt,
		updatedAt: image.updatedAt
	};
}

function mapSkuRecordFromProduct(
	product: {
		slug: string;
		name: string;
		nameEn: string | null;
		description: string | null;
		descriptionEn: string | null;
		categoryId: string | null;
		published: boolean;
		category: { slug: string } | null;
	},
	sku: {
		id: string;
		productId: string;
		skuCode: string;
		price: { toString(): string };
		stockQuantity: number;
		attributes: unknown;
		deletedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
		images?: RawImageRecord[];
	}
): CatalogSkuRecord {
	return {
		id: sku.id,
		productId: sku.productId,
		productSlug: product.slug,
		skuCode: sku.skuCode,
		name: product.name,
		nameEn: product.nameEn,
		description: product.description,
		descriptionEn: product.descriptionEn,
		categoryId: product.categoryId,
		categorySlug: product.category?.slug ?? null,
		price: Number(sku.price.toString()),
		stockQuantity: sku.stockQuantity,
		availability: sku.stockQuantity > 0 ? 'in_stock' : 'out_of_stock',
		published: product.published,
		attributes: (sku.attributes ?? {}) as Record<string, CatalogJsonValue>,
		deletedAt: sku.deletedAt,
		createdAt: sku.createdAt,
		updatedAt: sku.updatedAt,
		images: sku.images?.map((image) => mapImageRecord(image)) ?? []
	};
}

function mapSkuRecord(sku: {
	id: string;
	productId: string;
	skuCode: string;
	product: {
		slug: string;
		name: string;
		nameEn: string | null;
		description: string | null;
		descriptionEn: string | null;
		categoryId: string | null;
		published: boolean;
		category: { slug: string } | null;
	};
	price: { toString(): string };
	stockQuantity: number;
	attributes: unknown;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	images?: RawImageRecord[];
}): CatalogSkuRecord {
	return mapSkuRecordFromProduct(sku.product, sku);
}

function mapProductRecord(product: {
	id: string;
	slug: string;
	name: string;
	nameEn: string | null;
	description: string | null;
	descriptionEn: string | null;
	categoryId: string | null;
	published: boolean;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	thumbnailImageId: string | null;
	category: { slug: string } | null;
	images?: RawImageRecord[];
	skus?: Array<{
		id: string;
		productId: string;
		skuCode: string;
		price: { toString(): string };
		stockQuantity: number;
		attributes: unknown;
		deletedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
		images?: RawImageRecord[];
	}>;
}): CatalogProductRecord {
	const thumbnail = product.images?.find((image) => image.id === product.thumbnailImageId);
	return {
		id: product.id,
		slug: product.slug,
		name: product.name,
		nameEn: product.nameEn,
		description: product.description,
		descriptionEn: product.descriptionEn,
		categoryId: product.categoryId,
		categorySlug: product.category?.slug ?? null,
		published: product.published,
		deletedAt: product.deletedAt,
		createdAt: product.createdAt,
		updatedAt: product.updatedAt,
		thumbnail: thumbnail ? mapImageRecord(thumbnail, product.thumbnailImageId) : null,
		images:
			product.images
				?.filter((image) => image.id !== product.thumbnailImageId && image.skuId === null)
				.map((image) => mapImageRecord(image, product.thumbnailImageId)) ?? [],
		skus: product.skus?.map((sku) => mapSkuRecordFromProduct(product, sku)) ?? []
	};
}

function resolveCategoryOrderBy(sort: CategorySortField, order: 'asc' | 'desc') {
	switch (sort) {
		case 'name':
			return { name: order } as const;
		case 'createdAt':
			return { createdAt: order } as const;
		case 'updatedAt':
			return { updatedAt: order } as const;
		case 'position':
		default:
			return { position: order } as const;
	}
}

function resolveProductOrderBy(sort: ProductSortField, order: 'asc' | 'desc') {
	switch (sort) {
		case 'name':
			return { name: order } as const;
		case 'updatedAt':
			return { updatedAt: order } as const;
		case 'createdAt':
		default:
			return { createdAt: order } as const;
	}
}

function resolveSkuOrderBy(sort: SkuSortField | StorefrontSkuSortField, order: 'asc' | 'desc') {
	switch (sort) {
		case 'name':
			return { product: { name: order } } as const;
		case 'price':
			return { price: order } as const;
		case 'updatedAt':
			return { updatedAt: order } as const;
		case 'skuCode':
			return { skuCode: order } as const;
		case 'createdAt':
		default:
			return { createdAt: order } as const;
	}
}

function resolveImageOrderBy(sort: ImageSortField, order: 'asc' | 'desc') {
	switch (sort) {
		case 'createdAt':
			return { createdAt: order } as const;
		case 'updatedAt':
			return { updatedAt: order } as const;
		case 'position':
		default:
			return { position: order } as const;
	}
}

export function createPrismaCatalogRepository(database: DatabaseClient) {
	const countAssignedSkus = async (categoryId: string, publishedOnly = false): Promise<number> =>
		database.product.count({
			where: {
				categoryId,
				deletedAt: null,
				...(publishedOnly ? { published: true } : {})
			}
		});

	return {
		async listCategories(
			input: ListCategoriesInput,
			options: ListCategoriesOptions = {}
		): Promise<PaginatedResult<CatalogCategoryRecord>> {
			const where = {
				deletedAt: null,
				...(input.search
					? {
							OR: [
								{ name: { contains: input.search, mode: 'insensitive' as const } },
								{ nameEn: { contains: input.search, mode: 'insensitive' as const } },
								{ slug: { contains: input.search, mode: 'insensitive' as const } }
							]
						}
					: {}),
				...(input.parentId !== undefined ? { parentId: input.parentId } : {})
			};
			const paginate = options.paginate ?? true;
			const categories = await database.productCategory.findMany({
				where,
				orderBy: resolveCategoryOrderBy(input.sort, input.order),
				...(paginate && input.page && input.limit
					? {
							skip: (input.page - 1) * input.limit,
							take: input.limit
						}
					: {})
			});
			const total = paginate ? await database.productCategory.count({ where }) : categories.length;

			return {
				data: categories.map(mapCategoryRecord),
				total
			};
		},

		async listChildCategories(parentId: string): Promise<CatalogCategoryRecord[]> {
			const categories = await database.productCategory.findMany({
				where: {
					parentId,
					deletedAt: null
				},
				orderBy: [{ position: 'asc' }, { name: 'asc' }]
			});

			return categories.map(mapCategoryRecord);
		},

		async findCategoryById(categoryId: string): Promise<CatalogCategoryRecord | null> {
			const category = await database.productCategory.findFirst({
				where: {
					id: categoryId,
					deletedAt: null
				}
			});

			return category ? mapCategoryRecord(category) : null;
		},

		async findCategoryBySlug(slug: string): Promise<CatalogCategoryRecord | null> {
			const category = await database.productCategory.findFirst({
				where: {
					slug,
					deletedAt: null
				}
			});

			return category ? mapCategoryRecord(category) : null;
		},

		async listProducts(
			input: ListProductsInput,
			options: ListProductsOptions
		): Promise<PaginatedResult<CatalogProductRecord>> {
			const where = {
				...(input.archived === true
					? { deletedAt: { not: null } }
					: input.archived === false || !input.includeDeleted
						? { deletedAt: null }
						: {}),
				...(options.publishedOnly ? { published: true } : {}),
				...(input.published !== undefined ? { published: input.published } : {}),
				...(input.categoryId ? { categoryId: input.categoryId } : {}),
				...(input.categorySlug
					? {
							category: {
								is: {
									slug: input.categorySlug,
									deletedAt: null
								}
							}
						}
					: {}),
				...(input.search
					? {
							OR: [
								{ slug: { contains: input.search, mode: 'insensitive' as const } },
								{ name: { contains: input.search, mode: 'insensitive' as const } },
								{ nameEn: { contains: input.search, mode: 'insensitive' as const } },
								{ description: { contains: input.search, mode: 'insensitive' as const } },
								{ descriptionEn: { contains: input.search, mode: 'insensitive' as const } }
							]
						}
					: {})
			};
			const paginate = options.paginate ?? true;
			const products = await database.product.findMany({
				where,
				orderBy: resolveProductOrderBy(input.sort, input.order),
				include: {
					category: {
						select: {
							slug: true
						}
					},
					...(options.includeImages
						? {
								images: {
									where: { deletedAt: null },
									orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
								}
							}
						: {}),
					...(options.includeSkus
						? {
								skus: {
									where: {
										deletedAt: null
									},
									orderBy: [{ createdAt: 'asc' }],
									...(options.includeImages
										? {
												include: {
													images: {
														where: {
															deletedAt: null
														},
														orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
													}
												}
											}
										: {})
								}
							}
						: {})
				},
				...(paginate && input.page && input.limit
					? {
							skip: (input.page - 1) * input.limit,
							take: input.limit
						}
					: {})
			});
			const total = paginate ? await database.product.count({ where }) : products.length;

			return {
				data: products.map(mapProductRecord),
				total
			};
		},

		async findProductById(
			productId: string,
			options: FindProductOptions = {
				includeSkus: false,
				includeImages: false
			}
		): Promise<CatalogProductRecord | null> {
			const product = await database.product.findFirst({
				where: {
					id: productId,
					...(options.includeDeleted ? {} : { deletedAt: null }),
					...(options.publishedOnly ? { published: true } : {})
				},
				include: {
					category: {
						select: {
							slug: true
						}
					},
					...(options.includeImages
						? {
								images: {
									where: { deletedAt: null },
									orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
								}
							}
						: {}),
					...(options.includeSkus
						? {
								skus: {
									where: {
										deletedAt: null
									},
									orderBy: [{ createdAt: 'asc' }],
									...(options.includeImages
										? {
												include: {
													images: {
														where: {
															deletedAt: null
														},
														orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
													}
												}
											}
										: {})
								}
							}
						: {})
				}
			});

			return product ? mapProductRecord(product) : null;
		},

		async findProductBySlug(
			productSlug: string,
			options: FindProductOptions = {
				includeSkus: false,
				includeImages: false
			}
		): Promise<CatalogProductRecord | null> {
			const product = await database.product.findFirst({
				where: {
					slug: productSlug,
					deletedAt: null,
					...(options.publishedOnly ? { published: true } : {})
				},
				include: {
					category: {
						select: {
							slug: true
						}
					},
					...(options.includeImages
						? {
								images: {
									where: { deletedAt: null },
									orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
								}
							}
						: {}),
					...(options.includeSkus
						? {
								skus: {
									where: {
										deletedAt: null
									},
									orderBy: [{ createdAt: 'asc' }],
									...(options.includeImages
										? {
												include: {
													images: {
														where: {
															deletedAt: null
														},
														orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
													}
												}
											}
										: {})
								}
							}
						: {})
				}
			});

			return product ? mapProductRecord(product) : null;
		},

		async createProduct(input: {
			slug: string;
			name: string;
			nameEn?: string;
			description?: string;
			descriptionEn?: string;
			categoryId?: string | null;
			published: boolean;
		}): Promise<CatalogProductRecord> {
			const product = await database.product.create({
				data: {
					slug: input.slug,
					name: input.name,
					nameEn: input.nameEn ?? null,
					description: input.description ?? null,
					descriptionEn: input.descriptionEn ?? null,
					categoryId: input.categoryId ?? null,
					published: input.published
				},
				include: {
					category: {
						select: {
							slug: true
						}
					}
				}
			});

			return mapProductRecord(product);
		},

		async updateProduct(
			productId: string,
			input: {
				slug?: string;
				name?: string;
				nameEn?: string | null;
				description?: string | null;
				descriptionEn?: string | null;
				categoryId?: string | null;
				published?: boolean;
			}
		): Promise<CatalogProductRecord> {
			const product = await database.product.update({
				where: {
					id: productId
				},
				data: {
					slug: input.slug,
					name: input.name,
					nameEn: input.nameEn,
					description: input.description,
					descriptionEn: input.descriptionEn,
					categoryId: input.categoryId,
					published: input.published
				},
				include: {
					category: {
						select: {
							slug: true
						}
					}
				}
			});

			return mapProductRecord(product);
		},

		async softDeleteProduct(productId: string): Promise<void> {
			await database.product.update({
				where: {
					id: productId
				},
				data: {
					deletedAt: new Date(),
					published: false
				}
			});
		},

		async restoreProduct(productId: string): Promise<CatalogProductRecord> {
			const product = await database.product.update({
				where: { id: productId },
				data: { deletedAt: null },
				include: { category: { select: { slug: true } } }
			});
			return mapProductRecord(product);
		},

		async forceDeleteProduct(productId: string): Promise<void> {
			await database.product.delete({
				where: {
					id: productId
				}
			});
		},

		async bulkUpdateProducts(
			input: BulkProductUpdateInput
		): Promise<{ updatedCount: number; missingProductIds: string[]; invalidProductIds: string[] }> {
			return database.$transaction(async (transaction) => {
				const products = await transaction.product.findMany({
					where: { id: { in: input.productIds } },
					select: { id: true, deletedAt: true }
				});
				const byId = new Map(products.map((product) => [product.id, product]));
				const missingProductIds = input.productIds.filter((id) => !byId.has(id));
				const invalidProductIds = input.productIds.filter((id) => {
					const product = byId.get(id);
					if (!product) return false;
					if (input.action === 'restore') return !product.deletedAt;
					return Boolean(product.deletedAt);
				});

				if (missingProductIds.length > 0 || invalidProductIds.length > 0) {
					return { updatedCount: 0, missingProductIds, invalidProductIds };
				}

				const data =
					input.action === 'archive'
						? { deletedAt: new Date(), published: false }
						: input.action === 'restore'
							? { deletedAt: null }
							: { published: input.action === 'publish' };
				const result = await transaction.product.updateMany({
					where: { id: { in: input.productIds } },
					data
				});
				return { updatedCount: result.count, missingProductIds, invalidProductIds };
			});
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
			const category = await database.productCategory.create({
				data: {
					name: input.name,
					nameEn: input.nameEn ?? null,
					slug: input.slug,
					parentId: input.parentId ?? null,
					description: input.description ?? null,
					descriptionEn: input.descriptionEn ?? null,
					position: input.position
				}
			});

			return mapCategoryRecord(category);
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
			const category = await database.productCategory.update({
				where: {
					id: categoryId
				},
				data: {
					name: input.name,
					nameEn: input.nameEn,
					slug: input.slug,
					parentId: input.parentId,
					description: input.description,
					descriptionEn: input.descriptionEn,
					position: input.position
				}
			});

			return mapCategoryRecord(category);
		},

		async reorderCategorySiblings(input: CategoryReorderInput): Promise<boolean> {
			return database.$transaction(async (transaction) => {
				const siblings = await transaction.productCategory.findMany({
					where: {
						parentId: input.parentId,
						deletedAt: null
					},
					select: { id: true }
				});

				const siblingIds = new Set(siblings.map((category) => category.id));
				if (
					siblingIds.size !== input.categoryIds.length ||
					input.categoryIds.some((categoryId) => !siblingIds.has(categoryId))
				) {
					return false;
				}

				await Promise.all(
					input.categoryIds.map((categoryId, position) =>
						transaction.productCategory.update({
							where: { id: categoryId },
							data: { position }
						})
					)
				);

				return true;
			});
		},

		async deleteCategory(
			categoryId: string,
			input: CategoryDeletionInput
		): Promise<CategoryDeletionStatus> {
			return database.$transaction(async (transaction) => {
				const category = await transaction.productCategory.findFirst({
					where: { id: categoryId, deletedAt: null },
					select: { parentId: true, position: true }
				});
				if (!category) return 'not_found';

				const [children, productCount, siblings] = await Promise.all([
					transaction.productCategory.findMany({
						where: { parentId: categoryId, deletedAt: null },
						orderBy: [{ position: 'asc' }, { name: 'asc' }],
						select: { id: true }
					}),
					transaction.product.count({
						where: { categoryId, deletedAt: null }
					}),
					transaction.productCategory.findMany({
						where: {
							parentId: category.parentId,
							deletedAt: null,
							id: { not: categoryId }
						},
						orderBy: [{ position: 'asc' }, { name: 'asc' }],
						select: { id: true }
					})
				]);

				if (input.childDisposition === 'none' && children.length > 0) {
					return 'has_children';
				}
				if (input.productDisposition === 'none' && productCount > 0) {
					return 'has_products';
				}

				if (input.productDisposition === 'uncategorize') {
					await transaction.product.updateMany({
						where: { categoryId, deletedAt: null },
						data: { categoryId: null }
					});
				} else if (input.productDisposition === 'reassign' && input.reassignToCategoryId) {
					await transaction.product.updateMany({
						where: { categoryId, deletedAt: null },
						data: { categoryId: input.reassignToCategoryId }
					});
				}

				const orderedSiblingIds = siblings.map((sibling) => sibling.id);
				const insertionPosition = Math.min(category.position, orderedSiblingIds.length);
				if (input.childDisposition === 'promote') {
					orderedSiblingIds.splice(insertionPosition, 0, ...children.map((child) => child.id));
					await Promise.all(
						children.map((child, index) =>
							transaction.productCategory.update({
								where: { id: child.id },
								data: {
									parentId: category.parentId,
									position: insertionPosition + index
								}
							})
						)
					);
				}

				await Promise.all(
					orderedSiblingIds.map((siblingId, position) =>
						transaction.productCategory.update({
							where: { id: siblingId },
							data: { position }
						})
					)
				);
				await transaction.productCategory.update({
					where: { id: categoryId },
					data: { deletedAt: new Date() }
				});

				return 'deleted';
			});
		},

		async slugExists(slug: string, excludeCategoryId?: string): Promise<boolean> {
			const count = await database.productCategory.count({
				where: {
					slug,
					...(excludeCategoryId
						? {
								id: {
									not: excludeCategoryId
								}
							}
						: {})
				}
			});

			return count > 0;
		},

		async productSlugExists(slug: string, excludeProductId?: string): Promise<boolean> {
			const count = await database.product.count({
				where: {
					slug,
					...(excludeProductId
						? {
								id: {
									not: excludeProductId
								}
							}
						: {})
				}
			});

			return count > 0;
		},

		async hasCircularParent(input: {
			categoryId: string;
			parentId: string | null;
		}): Promise<boolean> {
			let currentParentId = input.parentId;

			while (currentParentId) {
				if (currentParentId === input.categoryId) {
					return true;
				}

				const parent = await database.productCategory.findFirst({
					where: {
						id: currentParentId,
						deletedAt: null
					},
					select: {
						parentId: true
					}
				});

				currentParentId = parent?.parentId ?? null;
			}

			return false;
		},

		async countAssignedSkus(categoryId: string, publishedOnly = false): Promise<number> {
			return countAssignedSkus(categoryId, publishedOnly);
		},

		async countProductsForCategoryIds(
			categoryIds: string[],
			publishedOnly = false
		): Promise<Record<string, number>> {
			const counts = await Promise.all(
				categoryIds.map(async (categoryId) => ({
					categoryId,
					total: await countAssignedSkus(categoryId, publishedOnly)
				}))
			);

			return counts.reduce<Record<string, number>>((accumulator, entry) => {
				accumulator[entry.categoryId] = entry.total;
				return accumulator;
			}, {});
		},

		async listSkus(
			input: ListSkusInput,
			options: ListSkusOptions
		): Promise<PaginatedResult<CatalogSkuRecord>> {
			const productWhere = {
				deletedAt: null,
				...(options.publishedOnly ? { published: true } : {}),
				...(input.published !== undefined ? { published: input.published } : {}),
				...(input.categoryId ? { categoryId: input.categoryId } : {}),
				...(input.categorySlug
					? {
							category: {
								is: {
									slug: input.categorySlug,
									deletedAt: null
								}
							}
						}
					: {})
			};
			const where = {
				deletedAt: null,
				product: {
					is: productWhere
				},
				...(input.search
					? {
							OR: [
								{ skuCode: { contains: input.search, mode: 'insensitive' as const } },
								{
									product: {
										is: { name: { contains: input.search, mode: 'insensitive' as const } }
									}
								},
								{
									product: {
										is: { nameEn: { contains: input.search, mode: 'insensitive' as const } }
									}
								},
								{
									product: {
										is: { description: { contains: input.search, mode: 'insensitive' as const } }
									}
								},
								{
									product: {
										is: {
											descriptionEn: { contains: input.search, mode: 'insensitive' as const }
										}
									}
								}
							]
						}
					: {}),
				...(input.minPrice !== undefined ? { price: { gte: input.minPrice } } : {}),
				...(input.maxPrice !== undefined ? { price: { lte: input.maxPrice } } : {})
			};
			const paginate = options.paginate ?? true;
			const skus = await database.productSku.findMany({
				where,
				orderBy: resolveSkuOrderBy(input.sort, input.order),
				include: {
					product: {
						select: {
							slug: true,
							name: true,
							nameEn: true,
							description: true,
							descriptionEn: true,
							categoryId: true,
							published: true,
							category: {
								select: {
									slug: true
								}
							}
						}
					},
					...(options.includeImages
						? {
								images: {
									where: {
										deletedAt: null
									},
									orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
								}
							}
						: {})
				},
				...(paginate && input.page && input.limit
					? {
							skip: (input.page - 1) * input.limit,
							take: input.limit
						}
					: {})
			});
			const total = paginate ? await database.productSku.count({ where }) : skus.length;

			return {
				data: skus.map(mapSkuRecord),
				total
			};
		},

		async findSkuById(skuId: string, options: FindSkuOptions): Promise<CatalogSkuRecord | null> {
			const sku = await database.productSku.findFirst({
				where: {
					id: skuId,
					deletedAt: null,
					product: {
						is: {
							deletedAt: null,
							...(options.publishedOnly ? { published: true } : {})
						}
					}
				},
				include: {
					product: {
						select: {
							slug: true,
							name: true,
							nameEn: true,
							description: true,
							descriptionEn: true,
							categoryId: true,
							published: true,
							category: {
								select: {
									slug: true
								}
							}
						}
					},
					...(options.includeImages
						? {
								images: {
									where: {
										deletedAt: null
									},
									orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
								}
							}
						: {})
				}
			});

			return sku ? mapSkuRecord(sku) : null;
		},

		async findSkuByCode(
			skuCode: string,
			options: FindSkuOptions
		): Promise<CatalogSkuRecord | null> {
			const sku = await database.productSku.findFirst({
				where: {
					skuCode,
					deletedAt: null,
					product: {
						is: {
							deletedAt: null,
							...(options.publishedOnly ? { published: true } : {})
						}
					}
				},
				include: {
					product: {
						select: {
							slug: true,
							name: true,
							nameEn: true,
							description: true,
							descriptionEn: true,
							categoryId: true,
							published: true,
							category: {
								select: {
									slug: true
								}
							}
						}
					},
					...(options.includeImages
						? {
								images: {
									where: {
										deletedAt: null
									},
									orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
								}
							}
						: {})
				}
			});

			return sku ? mapSkuRecord(sku) : null;
		},

		async createSku(input: {
			productId: string;
			skuCode: string;
			price: number;
			stockQuantity: number;
			attributes: Record<string, CatalogJsonValue>;
		}): Promise<CatalogSkuRecord> {
			const sku = await database.productSku.create({
				data: {
					productId: input.productId,
					skuCode: input.skuCode,
					price: input.price,
					stockQuantity: input.stockQuantity,
					attributes: input.attributes
				},
				include: {
					product: {
						select: {
							slug: true,
							name: true,
							nameEn: true,
							description: true,
							descriptionEn: true,
							categoryId: true,
							published: true,
							category: {
								select: {
									slug: true
								}
							}
						}
					}
				}
			});

			return mapSkuRecord(sku);
		},

		async updateSku(
			skuId: string,
			input: {
				productId?: string;
				skuCode?: string;
				price?: number;
				stockQuantity?: number;
				attributes?: Record<string, CatalogJsonValue>;
			}
		): Promise<CatalogSkuRecord> {
			const sku = await database.productSku.update({
				where: {
					id: skuId
				},
				data: {
					productId: input.productId,
					skuCode: input.skuCode,
					price: input.price,
					stockQuantity: input.stockQuantity,
					attributes: input.attributes
				},
				include: {
					product: {
						select: {
							slug: true,
							name: true,
							nameEn: true,
							description: true,
							descriptionEn: true,
							categoryId: true,
							published: true,
							category: {
								select: {
									slug: true
								}
							}
						}
					}
				}
			});

			return mapSkuRecord(sku);
		},

		async softDeleteSku(skuId: string): Promise<void> {
			await database.productSku.update({
				where: {
					id: skuId
				},
				data: {
					deletedAt: new Date()
				}
			});
		},

		async forceDeleteSku(skuId: string): Promise<void> {
			await database.productSku.delete({
				where: {
					id: skuId
				}
			});
		},

		async skuCodeExists(skuCode: string, excludeSkuId?: string): Promise<boolean> {
			const count = await database.productSku.count({
				where: {
					skuCode,
					...(excludeSkuId
						? {
								id: {
									not: excludeSkuId
								}
							}
						: {})
				}
			});

			return count > 0;
		},

		async listImages(
			productId: string,
			input: ListImagesInput
		): Promise<PaginatedResult<CatalogImageRecord>> {
			const product = await database.product.findUnique({
				where: { id: productId },
				select: { thumbnailImageId: true }
			});
			const thumbnailImageId = product?.thumbnailImageId ?? null;
			const where = {
				productId,
				deletedAt: input.state === 'deleted' ? { not: null } : null,
				...(input.placement === 'thumbnail'
					? { id: thumbnailImageId ?? '__missing-thumbnail__' }
					: input.placement === 'shared-gallery'
						? { skuId: null, ...(thumbnailImageId ? { id: { not: thumbnailImageId } } : {}) }
						: input.placement === 'sku-gallery'
							? { skuId: { not: null } }
							: {})
			};
			const images = await database.productImage.findMany({
				where,
				orderBy: resolveImageOrderBy(input.sort, input.order),
				skip: (input.page - 1) * input.limit,
				take: input.limit
			});
			const total = await database.productImage.count({ where });

			return {
				data: images.map((image) => mapImageRecord(image, thumbnailImageId)),
				total
			};
		},

		async findImageById(
			productId: string,
			imageId: string,
			includeDeleted = false
		): Promise<CatalogImageRecord | null> {
			const [product, image] = await Promise.all([
				database.product.findUnique({
					where: { id: productId },
					select: { thumbnailImageId: true }
				}),
				database.productImage.findFirst({
					where: {
						id: imageId,
						productId,
						...(includeDeleted ? {} : { deletedAt: null })
					}
				})
			]);

			return image ? mapImageRecord(image, product?.thumbnailImageId) : null;
		},

		async createImageUpload(input: { productId: string; assetKey: string; expiresAt: Date }) {
			return database.productImageUpload.create({
				data: input,
				select: { id: true, assetKey: true, expiresAt: true }
			});
		},

		async findImageUpload(productId: string, uploadId: string) {
			return database.productImageUpload.findFirst({
				where: { id: uploadId, productId, consumedAt: null },
				select: { id: true, assetKey: true, expiresAt: true }
			});
		},

		async consumeImageUpload(
			productId: string,
			uploadId: string,
			input: {
				skuId?: string | null;
				imageUrl: string;
				assetKey: string;
				altText: string;
				placement: 'thumbnail' | 'shared-gallery' | 'sku-gallery';
				focusX?: number | null;
				focusY?: number | null;
				zoom?: number | null;
			}
		): Promise<CatalogImageRecord | null> {
			const now = new Date();
			return database.$transaction(async (transaction) => {
				const consumedUpload = await transaction.productImageUpload.updateMany({
					where: {
						id: uploadId,
						productId,
						assetKey: input.assetKey,
						consumedAt: null,
						expiresAt: { gt: now }
					},
					data: { consumedAt: now }
				});
				if (consumedUpload.count !== 1) return null;

				const product = await transaction.product.findUniqueOrThrow({
					where: { id: productId },
					select: { thumbnailImageId: true }
				});
				if (input.placement === 'thumbnail' && product.thumbnailImageId) {
					await transaction.productImage.updateMany({
						where: { id: product.thumbnailImageId },
						data: { focusX: null, focusY: null, zoom: null }
					});
				}

				const lastImage = await transaction.productImage.findFirst({
					where: { productId, skuId: input.skuId ?? null, deletedAt: null },
					orderBy: { position: 'desc' },
					select: { position: true }
				});

				const image = await transaction.productImage.create({
					data: {
						productId,
						skuId: input.skuId ?? null,
						imageUrl: input.imageUrl,
						assetKey: input.assetKey,
						altText: input.altText,
						position: (lastImage?.position ?? -1) + 1,
						focusX: input.placement === 'thumbnail' ? (input.focusX ?? 0.5) : null,
						focusY: input.placement === 'thumbnail' ? (input.focusY ?? 0.5) : null,
						zoom: input.placement === 'thumbnail' ? (input.zoom ?? 1) : null
					}
				});
				await transaction.product.update({
					where: { id: productId },
					data: {
						...(input.placement === 'thumbnail' ? { thumbnailImageId: image.id } : {}),
						updatedAt: now
					}
				});
				return mapImageRecord(
					image,
					input.placement === 'thumbnail' ? image.id : product.thumbnailImageId
				);
			});
		},

		async restoreImage(imageId: string): Promise<CatalogImageRecord> {
			const image = await database.$transaction(async (transaction) => {
				const restored = await transaction.productImage.update({
					where: { id: imageId },
					data: { deletedAt: null, focusX: null, focusY: null, zoom: null }
				});
				await transaction.product.update({
					where: { id: restored.productId },
					data: { updatedAt: new Date() }
				});
				return restored;
			});
			return mapImageRecord(image);
		},

		async listExpiredImages(before: Date) {
			const images = await database.productImage.findMany({
				where: { deletedAt: { not: null, lte: before } },
				select: { id: true, productId: true, assetKey: true }
			});
			return images;
		},

		async listExpiredImageUploads(now: Date) {
			return database.productImageUpload.findMany({
				where: { consumedAt: null, expiresAt: { lte: now } },
				select: { id: true, assetKey: true }
			});
		},

		async deleteImageUpload(uploadId: string): Promise<void> {
			await database.productImageUpload.delete({ where: { id: uploadId } });
		},

		async updateImageCrop(
			imageId: string,
			input: { focusX: number; focusY: number; zoom: number }
		): Promise<CatalogImageRecord> {
			const image = await database.$transaction(async (transaction) => {
				const updated = await transaction.productImage.update({
					where: { id: imageId },
					data: input
				});
				await transaction.product.update({
					where: { id: updated.productId },
					data: { updatedAt: new Date() }
				});
				return updated;
			});
			return mapImageRecord(image);
		},

		async softDeleteImage(imageId: string): Promise<void> {
			await database.$transaction(async (transaction) => {
				const existing = await transaction.productImage.findUniqueOrThrow({
					where: { id: imageId },
					select: { productId: true, thumbnailFor: { select: { id: true } } }
				});
				const image = await transaction.productImage.update({
					where: { id: imageId },
					data: { deletedAt: new Date() }
				});
				await transaction.product.update({
					where: { id: image.productId },
					data: {
						...(existing.thumbnailFor ? { thumbnailImageId: null } : {}),
						updatedAt: new Date()
					}
				});
			});
		},

		async forceDeleteImage(imageId: string): Promise<void> {
			await database.$transaction(async (transaction) => {
				const image = await transaction.productImage.delete({ where: { id: imageId } });
				await transaction.product.update({
					where: { id: image.productId },
					data: { updatedAt: new Date() }
				});
			});
		}
	};
}

export type CatalogRepository = ReturnType<typeof createPrismaCatalogRepository>;
