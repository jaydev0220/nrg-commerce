import type { CatalogLocale, CatalogQueryState, CatalogSort } from './types.js';
import { normalizeLocale, sortOptions } from './ui.js';

const attributePrefix = 'attribute.';

export function parseCatalogQueryState(
	searchParams: URLSearchParams,
	locale: CatalogLocale
): CatalogQueryState {
	const query = searchParams.get('q')?.trim() ?? '';
	const categorySlug = searchParams.get('category')?.trim() ?? null;
	const rawSort = searchParams.get('sort') as CatalogSort | null;
	const sort = sortOptions.find((option) => option === rawSort) ?? 'featured';
	const attributeFilters: Record<string, string[]> = {};

	for (const [key, value] of searchParams.entries()) {
		if (!key.startsWith(attributePrefix)) {
			continue;
		}

		const attributeKey = decodeURIComponent(key.slice(attributePrefix.length));
		const values = value
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean);

		if (values.length > 0) {
			attributeFilters[attributeKey] = values;
		}
	}

	return {
		locale,
		query,
		categorySlug,
		attributeFilters,
		sort
	};
}

export function buildCatalogQueryString(state: {
	query: string;
	categorySlug: string | null;
	sort: CatalogSort;
	attributeFilters: Record<string, string[]>;
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

	for (const [key, values] of Object.entries(state.attributeFilters)) {
		if (values.length === 0) {
			continue;
		}

		params.set(`${attributePrefix}${encodeURIComponent(key)}`, values.join(','));
	}

	return params.toString();
}

export function localeFromPathname(pathname: string): CatalogLocale {
	return normalizeLocale(pathname.startsWith('/en') ? 'en' : 'zh-tw');
}
