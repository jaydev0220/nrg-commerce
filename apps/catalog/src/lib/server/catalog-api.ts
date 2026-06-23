import { error } from '@sveltejs/kit';

import type {
	CatalogCategoryRecord,
	CatalogCategoryNode,
	CatalogProductRecord
} from '$lib/catalog/types.js';
import {
	getCatalogPreviewCategoryBySlug,
	getCatalogPreviewIndexData,
	getCatalogPreviewProductBySlug
} from '$lib/server/catalog-preview-data.js';

/*
function resolveApiBaseUrl(): string {
	const apiBaseUrl = env['PUBLIC_API_BASE_URL']?.trim();

	if (!apiBaseUrl) {
		throw error(500, 'PUBLIC_API_BASE_URL is not configured.');
	}

	return apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
}

async function fetchJson<T>(fetcher: typeof fetch, path: string, searchParams?: URLSearchParams): Promise<T> {
	const url = new URL(path, resolveApiBaseUrl());
	if (searchParams) {
		url.search = searchParams.toString();
	}

	const response = await fetcher(url);
	if (!response.ok) {
		throw error(response.status, `Catalog API request failed for ${url.pathname}.`);
	}

	return (await response.json()) as T;
}
*/

export async function fetchCatalogIndexData(_fetcher: typeof fetch): Promise<{
	products: CatalogProductRecord[];
	categories: CatalogCategoryNode[];
}> {
	void _fetcher;

	/*
	const productsQuery = new URLSearchParams({
		page: '1',
		limit: '100',
		includeSkus: 'true',
		includeImages: 'true',
		sort: 'createdAt',
		order: 'desc'
	});
	const categoryQuery = new URLSearchParams({
		includeTree: 'true',
		includeProductCount: 'true'
	});

	const [productsResponse, categoriesResponse] = await Promise.all([
		fetchJson<PaginatedResponse<CatalogProductRecord>>(
			_fetcher,
			'/api/storefront/products',
			productsQuery
		),
		fetchJson<{ data: CatalogCategoryNode[] }>(
			_fetcher,
			'/api/storefront/products/categories',
			categoryQuery
		)
	]);

	return {
		products: productsResponse.data,
		categories: categoriesResponse.data
	};
	*/

	return getCatalogPreviewIndexData();
}

export async function fetchCatalogProductBySlug(
	_fetcher: typeof fetch,
	productSlug: string
): Promise<CatalogProductRecord> {
	void _fetcher;

	/*
	const productQuery = new URLSearchParams({
		includeSkus: 'true',
		includeImages: 'true'
	});

	return fetchJson<CatalogProductRecord>(
		_fetcher,
		`/api/storefront/products/${encodeURIComponent(productSlug)}`,
		productQuery
	);
	*/

	const product = getCatalogPreviewProductBySlug(productSlug);
	if (!product) {
		throw error(404, `Catalog product "${productSlug}" was not found.`);
	}

	return product;
}

export async function fetchCatalogCategoryBySlug(
	_fetcher: typeof fetch,
	categorySlug: string
): Promise<CatalogCategoryRecord> {
	void _fetcher;

	/*
	return fetchJson<CatalogCategoryRecord>(
		_fetcher,
		`/api/storefront/products/categories/${encodeURIComponent(categorySlug)}`
	);
	*/

	const category = getCatalogPreviewCategoryBySlug(categorySlug);
	if (!category) {
		throw error(404, `Catalog category "${categorySlug}" was not found.`);
	}

	return category;
}
