import type { CatalogLocale } from './types.js';

export const sortOptions = ['featured', 'price-asc', 'price-desc', 'name'] as const;

const attributeKeyLabels: Record<string, Record<CatalogLocale, string>> = {
	bottom: { en: 'Bottom', 'zh-tw': '底色' },
	calibration: { en: 'Calibration', 'zh-tw': '校正等級' },
	cavities: { en: 'Cavities', 'zh-tw': '槽數' },
	coating: { en: 'Coating', 'zh-tw': '表面處理' },
	detector: { en: 'Detector', 'zh-tw': '感測器' },
	filter: { en: 'Filter', 'zh-tw': '濾芯' },
	format: { en: 'Format', 'zh-tw': '規格形式' },
	interface: { en: 'Interface', 'zh-tw': '介面' },
	lens: { en: 'Lens', 'zh-tw': '鏡頭' },
	material: { en: 'Material', 'zh-tw': '材質' },
	range: { en: 'Range', 'zh-tw': '量測範圍' },
	resolution: { en: 'Resolution', 'zh-tw': '解析度' },
	sterility: { en: 'Sterility', 'zh-tw': '滅菌狀態' },
	surface: { en: 'Surface', 'zh-tw': '表面特性' },
	volume: { en: 'Volume', 'zh-tw': '容量' }
};

const attributeValueLabels: Record<string, Record<CatalogLocale, string>> = {
	accredited: { en: 'Accredited', 'zh-tw': '認證校正' },
	'assay-ready': { en: 'Assay Ready', 'zh-tw': '分析即用' },
	black: { en: 'Black', 'zh-tw': '黑色' },
	bulk: { en: 'Bulk', 'zh-tw': '散裝' },
	'cell-grade': { en: 'Cell Grade', 'zh-tw': '細胞培養級' },
	clear: { en: 'Clear', 'zh-tw': '透明' },
	'low-bind': { en: 'Low Bind', 'zh-tw': '低吸附' },
	'non-sterile': { en: 'Non Sterile', 'zh-tw': '非無菌' },
	polypropylene: { en: 'Polypropylene', 'zh-tw': '聚丙烯' },
	rack: { en: 'Rack', 'zh-tw': '盒裝' },
	standard: { en: 'Standard', 'zh-tw': '標準型' },
	sterile: { en: 'Sterile', 'zh-tw': '無菌' },
	yes: { en: 'Yes', 'zh-tw': '有' }
};

function normalizeAttributeToken(value: string): string {
	return value.trim().toLowerCase();
}

function toEnglishDisplayText(value: string): string {
	return value
		.split(/([ _-]+)/)
		.map((segment) => {
			if (segment.trim().length === 0) {
				return ' ';
			}

			if (segment === '-' || segment === '_') {
				return ' ';
			}

			if (segment.includes(' ')) {
				return segment;
			}

			if (/[A-Z]/.test(segment) || /^[0-9]/.test(segment)) {
				return segment;
			}

			return `${segment[0]?.toUpperCase() ?? ''}${segment.slice(1)}`;
		})
		.join('')
		.replace(/\s+/g, ' ')
		.trim();
}

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

export function formatAttributeKey(locale: CatalogLocale, key: string): string {
	const normalizedKey = normalizeAttributeToken(key);
	const localizedLabel = attributeKeyLabels[normalizedKey]?.[locale];

	if (localizedLabel) {
		return localizedLabel;
	}

	return locale === 'en' ? toEnglishDisplayText(key) : key;
}

export function formatAttributeValue(locale: CatalogLocale, value: string): string {
	const normalizedValue = normalizeAttributeToken(value);
	const localizedLabel = attributeValueLabels[normalizedValue]?.[locale];

	if (localizedLabel) {
		return localizedLabel;
	}

	return locale === 'en' ? toEnglishDisplayText(value) : value;
}
