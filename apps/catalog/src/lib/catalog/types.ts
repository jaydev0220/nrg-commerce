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
	focusX?: number | null;
	focusY?: number | null;
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
	categoryId: string | null;
	categorySlug: string | null;
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
	categoryId: string | null;
	categorySlug: string | null;
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
	categorySlug: string | null;
	minimumPrice: number;
	maximumPrice: number;
	skuCount: number;
	representativeImage: CatalogImageRecord | null;
	product: CatalogProductRecord;
};

export type CatalogSort = 'featured' | 'price-asc' | 'price-desc' | 'name';

export type CatalogQueryState = {
	locale: CatalogLocale;
	query: string;
	categorySlug: string | null;
	sort: CatalogSort;
};

export type InquiryQueryState = {
	skuCode: string;
};

export type ProductOption = {
	value: string;
	label: string;
	available: boolean;
	selected: boolean;
};

export type ProductOptionGroup = {
	key: string;
	label: string;
	options: ProductOption[];
};

export type ProductSelectedAttribute = {
	key: string;
	label: string;
	value: string;
	valueLabel: string;
};

export type ProductConfigurationModel = {
	activeSku: CatalogSkuRecord;
	selectedAttributes: Record<string, string>;
	selectedAttributeEntries: ProductSelectedAttribute[];
	attributeKeys: string[];
	optionGroups: ProductOptionGroup[];
};
