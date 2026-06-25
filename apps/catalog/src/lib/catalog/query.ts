import type { CatalogLocale, CatalogQueryState, CatalogSort } from './types.js';
import { normalizeLocale, sortOptions } from './ui.js';

export function parseCatalogQueryState(
	searchParams: URLSearchParams,
	locale: CatalogLocale
): CatalogQueryState {
	const query = searchParams.get('q')?.trim() ?? '';
	const categorySlug = searchParams.get('category')?.trim() ?? null;
	const rawSort = searchParams.get('sort') as CatalogSort | null;
	const sort = sortOptions.find((option) => option === rawSort) ?? 'featured';

	return {
		locale,
		query,
		categorySlug,
		sort
	};
}

export function buildCatalogQueryString(state: {
	query: string;
	categorySlug: string | null;
	sort: CatalogSort;
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

	return params.toString();
}

export function localeFromPathname(pathname: string): CatalogLocale {
	return normalizeLocale(pathname.startsWith('/en') ? 'en' : 'zh-tw');
}
