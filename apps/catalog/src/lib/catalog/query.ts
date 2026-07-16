import type { CatalogLocale, CatalogQueryState, CatalogSort, InquiryQueryState } from './types.js';
import { normalizeLocale, sortOptions } from './ui.js';

export function parseCatalogQueryState(
	searchParams: URLSearchParams,
	locale: CatalogLocale
): CatalogQueryState {
	const query = searchParams.get('q')?.trim() ?? '';
	const categorySlug = searchParams.get('category')?.trim() ?? null;
	const rawSort = searchParams.get('sort') as CatalogSort | null;
	const sort = sortOptions.find((option) => option === rawSort) ?? 'featured';
	const rawPage = Number.parseInt(searchParams.get('page') ?? '', 10);
	const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;

	return {
		locale,
		query,
		categorySlug,
		sort,
		page
	};
}

export function buildCatalogQueryString(state: {
	query: string;
	categorySlug: string | null;
	sort: CatalogSort;
	page?: number;
}): string {
	const params = new URLSearchParams();

	if (state.query.trim().length > 0) {
		params.set('q', state.query.trim());
	}

	if (state.categorySlug) {
		params.set('category', state.categorySlug);
	}

	if (state.sort !== 'featured') {
		params.set('sort', state.sort);
	}

	if (state.page && state.page > 1) {
		params.set('page', String(state.page));
	}

	return params.toString();
}

export function parseInquiryQueryState(searchParams: URLSearchParams): InquiryQueryState {
	return {
		skuCode: searchParams.get('sku')?.trim() ?? ''
	};
}

export function buildInquiryQueryString(state: InquiryQueryState): string {
	const params = new URLSearchParams();
	const skuCode = state.skuCode.trim();

	if (skuCode) {
		params.set('sku', skuCode);
	}

	return params.toString();
}

export function localeFromPathname(pathname: string): CatalogLocale {
	return normalizeLocale(pathname.startsWith('/en') ? 'en' : 'zh-tw');
}
