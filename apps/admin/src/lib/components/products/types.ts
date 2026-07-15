import type { ManagedProduct } from '$lib/api/admin-api';

export type ProductListItem = ManagedProduct & {
	isDeleted: boolean;
	categoryName: string;
	skuCount: number;
	updatedLabel: string;
};

export type ProductCategoryOption = {
	label: string;
	value: string;
};

export type ProductBulkAction = 'archive' | 'restore' | 'publish' | 'unpublish';

export type ProductCreateInput = {
	slug: string;
	name: string;
	nameEn?: string;
	description?: string;
	descriptionEn?: string;
	categoryId?: string | null;
	published: boolean;
};

export type ProductProfileInput = {
	slug: string;
	name: string;
	nameEn: string | null;
	description: string | null;
	descriptionEn: string | null;
	categoryId: string | null;
	published: boolean;
};

export type ProductSkuInput = {
	skuCode: string;
	price: number;
	attributes: Record<string, unknown>;
};

export type ProductImageUploadInput = {
	skuId: string;
	file: File;
	altText: string;
	type: 'thumbnail' | 'gallery';
	focusX: number | null;
	focusY: number | null;
	zoom: number | null;
};

export type ProductAttributeRow = {
	id: number;
	key: string;
	value: string;
};
