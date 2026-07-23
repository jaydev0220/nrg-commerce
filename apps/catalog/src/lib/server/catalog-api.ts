import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import {
	storefrontCategoryResponseSchema,
	storefrontCategoryTreeListResponseSchema,
	storefrontProductListResponseSchema,
	storefrontProductResponseSchema,
	type ZodType
} from '@packages/schemas';

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
	const apiBaseUrl = env['PUBLIC_API_BASE_URL']?.trim();

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

function upstreamHttpError(status: number) {
	const responseStatus = status >= 400 && status <= 599 ? status : 502;
	return error(
		responseStatus,
		responseStatus >= 500
			? 'The catalog service is temporarily unavailable.'
			: 'The requested catalog resource could not be found.'
	);
}

function isHttpError(value: unknown): value is { status: number } {
	return Boolean(value && typeof value === 'object' && 'status' in value);
}

async function fetchJson<T>(
	fetcher: typeof fetch,
	path: string,
	schema: ZodType<T>,
	searchParams?: URLSearchParams
): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), apiRequestTimeoutMs);

	try {
		const response = await fetcher(createRequestUrl(path, searchParams), {
			signal: controller.signal
		});
		if (!response.ok) throw upstreamHttpError(response.status);

		const parsed = schema.safeParse(await response.json());
		if (!parsed.success) {
			throw error(502, 'The catalog service returned an invalid response.');
		}
		return parsed.data;
	} catch (requestError) {
		if (isHttpError(requestError)) throw requestError;
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
		fetchJson(
			fetcher,
			'/api/storefront/products',
			storefrontProductListResponseSchema,
			productsQuery
		),
		fetchJson(
			fetcher,
			'/api/storefront/products/categories',
			storefrontCategoryTreeListResponseSchema,
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

	return fetchJson(
		fetcher,
		`/api/storefront/products/${encodeURIComponent(productSlug)}`,
		storefrontProductResponseSchema,
		productQuery
	);
}

export async function fetchCatalogSitemapProducts(fetcher: typeof fetch) {
	const products: Pick<CatalogProductRecord, 'slug' | 'updatedAt'>[] = [];
	let page = 1;

	while (true) {
		const response = await fetchJson(
			fetcher,
			'/api/storefront/products',
			storefrontProductListResponseSchema,
			new URLSearchParams({ page: String(page), limit: '100', sort: 'createdAt', order: 'desc' })
		);
		products.push(...response.data.map(({ slug, updatedAt }) => ({ slug, updatedAt })));
		if (page >= response.pagination.totalPages) break;
		page += 1;
	}

	return products;
}

export async function fetchCatalogCategoryBySlug(
	fetcher: typeof fetch,
	categorySlug: string
): Promise<CatalogCategoryRecord> {
	return fetchJson(
		fetcher,
		`/api/storefront/products/categories/${encodeURIComponent(categorySlug)}`,
		storefrontCategoryResponseSchema
	);
}
