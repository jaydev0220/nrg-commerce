import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';

import type {
	CatalogCategoryRecord,
	CatalogCategoryNode,
	CatalogProductRecord,
	PaginatedResponse
} from '$lib/catalog/types.js';

const apiRequestTimeoutMs = 5_000;

export type CatalogIndexQuery = {
	page: number;
	limit: number;
	search?: string;
	categorySlug?: string;
	sort: 'name' | 'createdAt' | 'minPrice';
	order: 'asc' | 'desc';
};

export type CatalogIndexData = {
	products: CatalogProductRecord[];
	categories: CatalogCategoryNode[];
	pagination: PaginatedResponse<CatalogProductRecord>['pagination'];
};

function resolveApiBaseUrl(): string {
	const apiBaseUrl = env.PUBLIC_API_BASE_URL?.trim();

	if (!apiBaseUrl) {
		throw error(500, 'The catalog service is not configured.');
	}

	return apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
}

function createRequestUrl(path: string, searchParams?: URLSearchParams): string {
	const url = new URL(path, resolveApiBaseUrl());
	if (searchParams) {
		url.search = searchParams.toString();
	}

	return url.toString();
}

async function fetchJson<T>(fetcher: typeof fetch, path: string, searchParams?: URLSearchParams) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), apiRequestTimeoutMs);
	const url = createRequestUrl(path, searchParams);

	try {
		const response = await fetcher(url, { signal: controller.signal });
		if (!response.ok) {
			const status = response.status >= 400 && response.status <= 599 ? response.status : 502;
			throw error(
				status,
				status >= 500
					? 'The catalog service is temporarily unavailable.'
					: 'The requested catalog resource could not be found.'
			);
		}

		return (await response.json()) as T;
	} catch (requestError) {
		if (requestError && typeof requestError === 'object' && 'status' in requestError) {
			throw requestError;
		}

		throw error(502, 'The catalog service is temporarily unavailable.');
	} finally {
		clearTimeout(timeout);
	}
}

export async function fetchCatalogIndexData(
	fetcher: typeof fetch,
	query: CatalogIndexQuery
): Promise<CatalogIndexData> {
	const productsQuery = new URLSearchParams({
		page: String(query.page),
		limit: String(query.limit),
		includeSkus: 'true',
		includeImages: 'true',
		sort: query.sort,
		order: query.order
	});
	const categoryQuery = new URLSearchParams({
		includeTree: 'true',
		includeProductCount: 'true'
	});

	if (query.search) {
		productsQuery.set('search', query.search);
	}
	if (query.categorySlug) {
		productsQuery.set('categorySlug', query.categorySlug);
	}

	const [productsResponse, categoriesResponse] = await Promise.all([
		fetchJson<PaginatedResponse<CatalogProductRecord>>(
			fetcher,
			'/api/storefront/products',
			productsQuery
		),
		fetchJson<{ data: CatalogCategoryNode[] }>(
			fetcher,
			'/api/storefront/products/categories',
			categoryQuery
		)
	]);

	return {
		products: productsResponse.data,
		categories: categoriesResponse.data,
		pagination: productsResponse.pagination
	};
}

export async function fetchCatalogProductBySlug(
	fetcher: typeof fetch,
	productSlug: string
): Promise<CatalogProductRecord> {
	const productQuery = new URLSearchParams({
		includeSkus: 'true',
		includeImages: 'true'
	});

	return fetchJson<CatalogProductRecord>(
		fetcher,
		`/api/storefront/products/${encodeURIComponent(productSlug)}`,
		productQuery
	);
}

export async function fetchCatalogCategoryBySlug(
	fetcher: typeof fetch,
	categorySlug: string
): Promise<CatalogCategoryRecord> {
	return fetchJson<CatalogCategoryRecord>(
		fetcher,
		`/api/storefront/products/categories/${encodeURIComponent(categorySlug)}`
	);
}
