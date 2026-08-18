import type { CatalogLocale } from './types.js';

export const sortOptions = ['featured', 'price-asc', 'price-desc', 'name'] as const;

type LocalizedLabel = Record<CatalogLocale, string>;

function normalizeAttributeToken(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, '');
}

function createLocalizedLabelMap(
	entries: Record<string, LocalizedLabel>
): Record<string, LocalizedLabel> {
	return Object.fromEntries(
		Object.entries(entries).map(([key, label]) => [normalizeAttributeToken(key), label])
	);
}

const attributeKeyLabels = createLocalizedLabelMap({
	bottom: { en: 'Bottom', 'zh-tw': '底色' },
	calibration: { en: 'Calibration', 'zh-tw': '校正等級' },
	cavities: { en: 'Cavities', 'zh-tw': '槽數' },
	coating: { en: 'Coating', 'zh-tw': '表面處理' },
	color: { en: 'Color', 'zh-tw': '顏色' },
	capacity: { en: 'Capacity', 'zh-tw': '容量' },
	countryOfOrigin: { en: 'Country of Origin', 'zh-tw': '原產國' },
	depth: { en: 'Depth', 'zh-tw': '深度' },
	detector: { en: 'Detector', 'zh-tw': '感測器' },
	diameter: { en: 'Diameter', 'zh-tw': '直徑' },
	filter: { en: 'Filter', 'zh-tw': '濾芯' },
	format: { en: 'Format', 'zh-tw': '規格形式' },
	gtin: { en: 'GTIN', 'zh-tw': '全球貿易項目代碼（GTIN）' },
	height: { en: 'Height', 'zh-tw': '高度' },
	innerDiameter: { en: 'Inner Diameter', 'zh-tw': '內徑' },
	interface: { en: 'Interface', 'zh-tw': '介面' },
	jointSize: { en: 'Joint Size', 'zh-tw': '標準磨口尺寸' },
	lens: { en: 'Lens', 'zh-tw': '鏡頭' },
	length: { en: 'Length', 'zh-tw': '長度' },
	material: { en: 'Material', 'zh-tw': '材質' },
	model: { en: 'Model', 'zh-tw': '型號' },
	mpn: { en: 'MPN', 'zh-tw': '製造商零件編號（MPN）' },
	outerDiameter: { en: 'Outer Diameter', 'zh-tw': '外徑' },
	pattern: { en: 'Pattern', 'zh-tw': '圖樣' },
	range: { en: 'Range', 'zh-tw': '量測範圍' },
	resolution: { en: 'Resolution', 'zh-tw': '解析度' },
	size: { en: 'Size', 'zh-tw': '尺寸' },
	sterility: { en: 'Sterility', 'zh-tw': '滅菌狀態' },
	surface: { en: 'Surface', 'zh-tw': '表面特性' },
	suggestedAge: { en: 'Suggested Age', 'zh-tw': '建議年齡' },
	suggestedGender: { en: 'Suggested Gender', 'zh-tw': '建議性別' },
	temperatureRange: { en: 'Temperature Range', 'zh-tw': '溫度範圍' },
	threadSize: { en: 'Thread Size', 'zh-tw': '螺紋尺寸' },
	volume: { en: 'Volume', 'zh-tw': '容量' },
	weight: { en: 'Weight', 'zh-tw': '重量' },
	width: { en: 'Width', 'zh-tw': '寬度' },
	wallThickness: { en: 'Wall Thickness', 'zh-tw': '壁厚' },
	graduation: { en: 'Graduation', 'zh-tw': '刻度' },
	autoclavable: { en: 'Autoclavable', 'zh-tw': '可高壓滅菌' }
});

const attributeValueLabels = createLocalizedLabelMap({
	accredited: { en: 'Accredited', 'zh-tw': '認證校正' },
	'assay-ready': { en: 'Assay Ready', 'zh-tw': '分析即用' },
	aseptic: { en: 'Aseptic', 'zh-tw': '無菌操作' },
	amber: { en: 'Amber', 'zh-tw': '琥珀色' },
	black: { en: 'Black', 'zh-tw': '黑色' },
	blue: { en: 'Blue', 'zh-tw': '藍色' },
	borosilicate: { en: 'Borosilicate Glass', 'zh-tw': '硼矽玻璃' },
	'borosilicate glass': { en: 'Borosilicate Glass', 'zh-tw': '硼矽玻璃' },
	bulk: { en: 'Bulk', 'zh-tw': '散裝' },
	'cell-grade': { en: 'Cell Grade', 'zh-tw': '細胞培養級' },
	clear: { en: 'Clear', 'zh-tw': '透明' },
	'class-a': { en: 'Class A', 'zh-tw': 'A級' },
	'class-b': { en: 'Class B', 'zh-tw': 'B級' },
	false: { en: 'False', 'zh-tw': '否' },
	fep: { en: 'FEP', 'zh-tw': 'FEP' },
	glass: { en: 'Glass', 'zh-tw': '玻璃' },
	gray: { en: 'Gray', 'zh-tw': '灰色' },
	grey: { en: 'Gray', 'zh-tw': '灰色' },
	green: { en: 'Green', 'zh-tw': '綠色' },
	hdpe: { en: 'HDPE', 'zh-tw': 'HDPE' },
	'high-density polyethylene': {
		en: 'High-Density Polyethylene',
		'zh-tw': '高密度聚乙烯'
	},
	hydrophilic: { en: 'Hydrophilic', 'zh-tw': '親水性' },
	hydrophobic: { en: 'Hydrophobic', 'zh-tw': '疏水性' },
	'individually wrapped': { en: 'Individually Wrapped', 'zh-tw': '獨立包裝' },
	ldpe: { en: 'LDPE', 'zh-tw': 'LDPE' },
	'low-density polyethylene': {
		en: 'Low-Density Polyethylene',
		'zh-tw': '低密度聚乙烯'
	},
	'low-bind': { en: 'Low Bind', 'zh-tw': '低吸附' },
	natural: { en: 'Natural', 'zh-tw': '本色' },
	'non-sterile': { en: 'Non Sterile', 'zh-tw': '非無菌' },
	no: { en: 'No', 'zh-tw': '無' },
	pfa: { en: 'PFA', 'zh-tw': 'PFA' },
	polycarbonate: { en: 'Polycarbonate', 'zh-tw': '聚碳酸酯' },
	polyethylene: { en: 'Polyethylene', 'zh-tw': '聚乙烯' },
	polypropylene: { en: 'Polypropylene', 'zh-tw': '聚丙烯' },
	polystyrene: { en: 'Polystyrene', 'zh-tw': '聚苯乙烯' },
	pp: { en: 'PP', 'zh-tw': 'PP' },
	pc: { en: 'PC', 'zh-tw': 'PC' },
	pe: { en: 'PE', 'zh-tw': 'PE' },
	ps: { en: 'PS', 'zh-tw': 'PS' },
	ptfe: { en: 'PTFE', 'zh-tw': 'PTFE' },
	quartz: { en: 'Quartz', 'zh-tw': '石英' },
	rack: { en: 'Rack', 'zh-tw': '盒裝' },
	red: { en: 'Red', 'zh-tw': '紅色' },
	silicone: { en: 'Silicone', 'zh-tw': '矽膠' },
	'soda-lime glass': { en: 'Soda-Lime Glass', 'zh-tw': '鈉鈣玻璃' },
	standard: { en: 'Standard', 'zh-tw': '標準型' },
	'stainless steel': { en: 'Stainless Steel', 'zh-tw': '不鏽鋼' },
	sterile: { en: 'Sterile', 'zh-tw': '無菌' },
	transparent: { en: 'Transparent', 'zh-tw': '透明' },
	treated: { en: 'Treated', 'zh-tw': '已處理' },
	true: { en: 'True', 'zh-tw': '是' },
	untreated: { en: 'Untreated', 'zh-tw': '未處理' },
	white: { en: 'White', 'zh-tw': '白色' },
	yellow: { en: 'Yellow', 'zh-tw': '黃色' },
	yes: { en: 'Yes', 'zh-tw': '有' }
});

function toEnglishDisplayText(value: string): string {
	return value
		.trim()
		.replace(/([a-z\d])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.split(' ')
		.map((segment) => {
			if (!segment || /^[A-Z\d]+$/.test(segment)) return segment;
			return (segment[0]?.toUpperCase() ?? '') + segment.slice(1);
		})
		.join(' ');
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

	return toEnglishDisplayText(key);
}

export function formatAttributeValue(locale: CatalogLocale, value: string): string {
	const normalizedValue = normalizeAttributeToken(value);
	const localizedLabel = attributeValueLabels[normalizedValue]?.[locale];

	if (localizedLabel) {
		return localizedLabel;
	}

	return value;
}
