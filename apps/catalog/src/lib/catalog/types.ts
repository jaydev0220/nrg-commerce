export type CatalogLocale = 'zh-tw' | 'en';

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
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
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
	categoryId: string;
	categorySlug: string;
	price: number;
	published: boolean;
	attributes: Record<string, CatalogJsonValue>;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
	images: CatalogImageRecord[];
};

export type CatalogProductRecord = {
	id: string;
	slug: string;
	name: string;
	nameEn: string | null;
	description: string | null;
	descriptionEn: string | null;
	categoryId: string;
	categorySlug: string;
	published: boolean;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
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
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
	productCount?: number;
};

export type CatalogCategoryNode = CatalogCategoryRecord & {
	children: CatalogCategoryNode[];
};

export type CatalogCategoryListEntry = {
	category: CatalogCategoryNode;
	depth: number;
};

export type PaginatedResponse<T> = {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
};

export type CatalogProductView = {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	categorySlug: string;
	minimumPrice: number;
	maximumPrice: number;
	skuCount: number;
	representativeAttributes: Array<{
		key: string;
		values: string[];
	}>;
	representativeImage: CatalogImageRecord | null;
	product: CatalogProductRecord;
};

export type CatalogAttributeFacet = {
	key: string;
	values: string[];
};

export type CatalogSort = 'featured' | 'price-asc' | 'price-desc' | 'name';

export type CatalogQueryState = {
	locale: CatalogLocale;
	query: string;
	categorySlug: string | null;
	attributeFilters: Record<string, string[]>;
	sort: CatalogSort;
};

export type ProductOption = {
	value: string;
	available: boolean;
	selected: boolean;
};

export type ProductOptionGroup = {
	key: string;
	options: ProductOption[];
};

export type ProductConfigurationModel = {
	activeSku: CatalogSkuRecord;
	selectedAttributes: Record<string, string>;
	attributeKeys: string[];
	optionGroups: ProductOptionGroup[];
};
