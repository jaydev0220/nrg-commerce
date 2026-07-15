export type CatalogJsonValue =
	| string
	| number
	| boolean
	| null
	| CatalogJsonValue[]
	| { [key: string]: CatalogJsonValue };

export type CatalogImageRecord = {
	id: string;
	skuId: string;
	imageUrl: string;
	assetKey: string | null;
	altText: string;
	type: 'thumbnail' | 'gallery';
	position: number;
	focusX: number | null;
	focusY: number | null;
	zoom: number | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type CatalogSkuRecord = {
	id: string;
	productId: string;
	productSlug: string;
	skuCode: string;
	name: string;
	nameEn: string | null;
	description: string | null;
	descriptionEn: string | null;
	categoryId: string | null;
	categorySlug: string | null;
	price: number;
	published: boolean;
	attributes: Record<string, CatalogJsonValue>;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	images: CatalogImageRecord[];
};

export type CatalogProductRecord = {
	id: string;
	slug: string;
	name: string;
	nameEn: string | null;
	description: string | null;
	descriptionEn: string | null;
	categoryId: string | null;
	categorySlug: string | null;
	published: boolean;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	skus: CatalogSkuRecord[];
};

export type CatalogCategoryRecord = {
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
};

export type CatalogCategoryDetailRecord = CatalogCategoryRecord & {
	children?: CatalogCategoryRecord[];
	productCount?: number;
};

export type CatalogCategoryTreeRecord = CatalogCategoryRecord & {
	children: CatalogCategoryTreeRecord[];
	productCount?: number;
};

export type PaginatedResult<T> = {
	data: T[];
	total: number;
};
