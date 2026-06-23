import type { CatalogLocale } from './types.js';

export const sortOptions = ['featured', 'price-asc', 'price-desc', 'name'] as const;

export function localizeValue(
	locale: CatalogLocale,
	primary: string | null | undefined,
	secondary: string | null | undefined
): string {
	if (locale === 'en') {
		return secondary ?? primary ?? '';
	}

	return primary ?? secondary ?? '';
}

export function formatMoney(locale: CatalogLocale, value: number): string {
	return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-TW', {
		style: 'currency',
		currency: 'TWD',
		maximumFractionDigits: 0
	}).format(value);
}

export function normalizeLocale(input: string | null | undefined): CatalogLocale {
	return input?.toLowerCase() === 'en' ? 'en' : 'zh-tw';
}
