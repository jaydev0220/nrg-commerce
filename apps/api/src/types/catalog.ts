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
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type CatalogSkuRecord = {
	id: string;
	productId: string;
	skuCode: string;
	name: string;
	description: string | null;
	categoryId: string;
	categorySlug: string;
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
	name: string;
	description: string | null;
	categoryId: string;
	categorySlug: string;
	published: boolean;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	skus: CatalogSkuRecord[];
};

export type CatalogCategoryRecord = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
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
