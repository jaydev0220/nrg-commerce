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
};

type FindProductOptions = {
	includeSkus: boolean;
	includeImages: boolean;
	publishedOnly?: boolean;
};

type FindSkuOptions = {
	includeImages: boolean;
	publishedOnly?: boolean;
};

type ListImagesInput = {
	type?: 'thumbnail' | 'gallery';
	sort: ImageSortField;
	order: 'asc' | 'desc';
	page: number;
	limit: number;
};

type ListCategoriesOptions = {
	paginate?: boolean;
};

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

function mapImageRecord(image: {
	id: string;
	skuId: string;
	imageUrl: string;
	assetKey: string | null;
	altText: string;
	type: 'thumbnail' | 'gallery';
	position: number;
	focusX: number | null;
	focusY: number | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}): CatalogImageRecord {
	return {
		id: image.id,
		skuId: image.skuId,
		imageUrl: image.imageUrl,
		assetKey: image.assetKey,
		altText: image.altText,
		type: image.type,
		position: image.position,
		focusX: image.focusX,
		focusY: image.focusY,
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
		attributes: unknown;
		deletedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
		images?: Array<{
			id: string;
			skuId: string;
			imageUrl: string;
			assetKey: string | null;
			altText: string;
			type: 'thumbnail' | 'gallery';
			position: number;
			focusX: number | null;
			focusY: number | null;
			deletedAt: Date | null;
			createdAt: Date;
			updatedAt: Date;
		}>;
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
		published: product.published,
		attributes: (sku.attributes ?? {}) as Record<string, CatalogJsonValue>,
		deletedAt: sku.deletedAt,
		createdAt: sku.createdAt,
		updatedAt: sku.updatedAt,
		images: sku.images?.map(mapImageRecord) ?? []
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
	attributes: unknown;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	images?: Array<{
		id: string;
		skuId: string;
		imageUrl: string;
		assetKey: string | null;
		altText: string;
		type: 'thumbnail' | 'gallery';
		position: number;
		focusX: number | null;
		focusY: number | null;
		deletedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
	}>;
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
	category: { slug: string } | null;
	skus?: Array<{
		id: string;
		productId: string;
		skuCode: string;
		price: { toString(): string };
		attributes: unknown;
		deletedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
		images?: Array<{
			id: string;
			skuId: string;
			imageUrl: string;
			assetKey: string | null;
			altText: string;
			type: 'thumbnail' | 'gallery';
			position: number;
			focusX: number | null;
			focusY: number | null;
			deletedAt: Date | null;
			createdAt: Date;
			updatedAt: Date;
		}>;
	}>;
}): CatalogProductRecord {
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

export function createPrismaStorefrontCatalogRepository(database: DatabaseClient) {
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
					deletedAt: null,
					...(options.publishedOnly ? { published: true } : {})
				},
				include: {
					category: {
						select: {
							slug: true
						}
					},
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

		async reassignSkusToCategory(categoryId: string, targetCategoryId: string): Promise<void> {
			await database.product.updateMany({
				where: {
					categoryId,
					deletedAt: null
				},
				data: {
					categoryId: targetCategoryId
				}
			});
		},

		async softDeleteCategory(categoryId: string): Promise<void> {
			await database.productCategory.update({
				where: {
					id: categoryId
				},
				data: {
					deletedAt: new Date()
				}
			});
		},

		async forceDeleteCategory(categoryId: string): Promise<void> {
			await database.productCategory.delete({
				where: {
					id: categoryId
				}
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

		async hasChildCategories(categoryId: string): Promise<boolean> {
			const count = await database.productCategory.count({
				where: {
					parentId: categoryId,
					deletedAt: null
				}
			});

			return count > 0;
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
			attributes: Record<string, CatalogJsonValue>;
		}): Promise<CatalogSkuRecord> {
			const sku = await database.productSku.create({
				data: {
					productId: input.productId,
					skuCode: input.skuCode,
					price: input.price,
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
			skuId: string,
			input: ListImagesInput
		): Promise<PaginatedResult<CatalogImageRecord>> {
			const where = {
				skuId,
				deletedAt: null,
				...(input.type ? { type: input.type } : {})
			};
			const images = await database.productImage.findMany({
				where,
				orderBy: resolveImageOrderBy(input.sort, input.order),
				skip: (input.page - 1) * input.limit,
				take: input.limit
			});
			const total = await database.productImage.count({ where });

			return {
				data: images.map(mapImageRecord),
				total
			};
		},

		async findImageById(skuId: string, imageId: string): Promise<CatalogImageRecord | null> {
			const image = await database.productImage.findFirst({
				where: {
					id: imageId,
					skuId,
					deletedAt: null
				}
			});

			return image ? mapImageRecord(image) : null;
		},

		async createImage(
			skuId: string,
			input: {
				imageUrl: string;
				assetKey?: string;
				altText: string;
				type: 'thumbnail' | 'gallery';
				position: number;
			}
		): Promise<CatalogImageRecord> {
			const image = await database.productImage.create({
				data: {
					skuId,
					imageUrl: input.imageUrl,
					assetKey: input.assetKey ?? null,
					altText: input.altText,
					type: input.type,
					position: input.position
				}
			});

			return mapImageRecord(image);
		},

		async softDeleteImage(imageId: string): Promise<void> {
			await database.productImage.update({
				where: {
					id: imageId
				},
				data: {
					deletedAt: new Date()
				}
			});
		},

		async forceDeleteImage(imageId: string): Promise<void> {
			await database.productImage.delete({
				where: {
					id: imageId
				}
			});
		}
	};
}

export type StorefrontRepository = ReturnType<typeof createPrismaStorefrontCatalogRepository>;
