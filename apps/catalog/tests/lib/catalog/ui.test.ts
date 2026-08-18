import { expect, test } from 'vitest';

import { formatAttributeKey, formatAttributeValue } from '$lib/catalog/ui.js';

const attributeKeyLabels = [
	['bottom', 'Bottom', '底色'],
	['calibration', 'Calibration', '校正等級'],
	['cavities', 'Cavities', '槽數'],
	['coating', 'Coating', '表面處理'],
	['color', 'Color', '顏色'],
	['capacity', 'Capacity', '容量'],
	['countryOfOrigin', 'Country of Origin', '原產國'],
	['depth', 'Depth', '深度'],
	['detector', 'Detector', '感測器'],
	['diameter', 'Diameter', '直徑'],
	['filter', 'Filter', '濾芯'],
	['format', 'Format', '規格形式'],
	['gtin', 'GTIN', '全球貿易項目代碼（GTIN）'],
	['height', 'Height', '高度'],
	['innerDiameter', 'Inner Diameter', '內徑'],
	['interface', 'Interface', '介面'],
	['jointSize', 'Joint Size', '標準磨口尺寸'],
	['lens', 'Lens', '鏡頭'],
	['length', 'Length', '長度'],
	['material', 'Material', '材質'],
	['model', 'Model', '型號'],
	['mpn', 'MPN', '製造商零件編號（MPN）'],
	['outerDiameter', 'Outer Diameter', '外徑'],
	['pattern', 'Pattern', '圖樣'],
	['range', 'Range', '量測範圍'],
	['resolution', 'Resolution', '解析度'],
	['size', 'Size', '尺寸'],
	['sterility', 'Sterility', '滅菌狀態'],
	['surface', 'Surface', '表面特性'],
	['suggestedAge', 'Suggested Age', '建議年齡'],
	['suggestedGender', 'Suggested Gender', '建議性別'],
	['temperature-range', 'Temperature Range', '溫度範圍'],
	['threadSize', 'Thread Size', '螺紋尺寸'],
	['volume', 'Volume', '容量'],
	['weight', 'Weight', '重量'],
	['width', 'Width', '寬度'],
	['wallThickness', 'Wall Thickness', '壁厚'],
	['graduation', 'Graduation', '刻度'],
	['autoclavable', 'Autoclavable', '可高壓滅菌']
] as const;

for (const [key, english, traditionalChinese] of attributeKeyLabels) {
	test('formats the ' + key + ' attribute label', () => {
		expect(formatAttributeKey('en', key)).toBe(english);
		expect(formatAttributeKey('zh-tw', key)).toBe(traditionalChinese);
	});
}

test('normalizes structured-data attribute key aliases', () => {
	for (const key of ['temperatureRange', 'temperature-range', 'temperature_range']) {
		expect(formatAttributeKey('zh-tw', key)).toBe('溫度範圍');
	}
	for (const key of ['outerDiameter', 'outer-diameter', 'outer_diameter']) {
		expect(formatAttributeKey('en', key)).toBe('Outer Diameter');
	}
});

const attributeValueLabels = [
	['accredited', 'Accredited', '認證校正'],
	['amber', 'Amber', '琥珀色'],
	['aseptic', 'Aseptic', '無菌操作'],
	['assay-ready', 'Assay Ready', '分析即用'],
	['black', 'Black', '黑色'],
	['blue', 'Blue', '藍色'],
	['borosilicate glass', 'Borosilicate Glass', '硼矽玻璃'],
	['bulk', 'Bulk', '散裝'],
	['cell-grade', 'Cell Grade', '細胞培養級'],
	['clear', 'Clear', '透明'],
	['class-a', 'Class A', 'A級'],
	['class-b', 'Class B', 'B級'],
	['false', 'False', '否'],
	['fep', 'FEP', 'FEP'],
	['glass', 'Glass', '玻璃'],
	['gray', 'Gray', '灰色'],
	['green', 'Green', '綠色'],
	['hdpe', 'HDPE', 'HDPE'],
	['high-density polyethylene', 'High-Density Polyethylene', '高密度聚乙烯'],
	['hydrophilic', 'Hydrophilic', '親水性'],
	['hydrophobic', 'Hydrophobic', '疏水性'],
	['individually wrapped', 'Individually Wrapped', '獨立包裝'],
	['ldpe', 'LDPE', 'LDPE'],
	['low-density polyethylene', 'Low-Density Polyethylene', '低密度聚乙烯'],
	['low-bind', 'Low Bind', '低吸附'],
	['natural', 'Natural', '本色'],
	['non-sterile', 'Non Sterile', '非無菌'],
	['no', 'No', '無'],
	['pfa', 'PFA', 'PFA'],
	['polycarbonate', 'Polycarbonate', '聚碳酸酯'],
	['polyethylene', 'Polyethylene', '聚乙烯'],
	['polypropylene', 'Polypropylene', '聚丙烯'],
	['polystyrene', 'Polystyrene', '聚苯乙烯'],
	['pp', 'PP', 'PP'],
	['ptfe', 'PTFE', 'PTFE'],
	['quartz', 'Quartz', '石英'],
	['rack', 'Rack', '盒裝'],
	['red', 'Red', '紅色'],
	['silicone', 'Silicone', '矽膠'],
	['soda-lime glass', 'Soda-Lime Glass', '鈉鈣玻璃'],
	['standard', 'Standard', '標準型'],
	['stainless steel', 'Stainless Steel', '不鏽鋼'],
	['sterile', 'Sterile', '無菌'],
	['transparent', 'Transparent', '透明'],
	['treated', 'Treated', '已處理'],
	['true', 'True', '是'],
	['untreated', 'Untreated', '未處理'],
	['white', 'White', '白色'],
	['yellow', 'Yellow', '黃色'],
	['yes', 'Yes', '有']
] as const;

for (const [value, english, traditionalChinese] of attributeValueLabels) {
	test('formats the ' + value + ' attribute value', () => {
		expect(formatAttributeValue('en', value)).toBe(english);
		expect(formatAttributeValue('zh-tw', value)).toBe(traditionalChinese);
	});
}

test('normalizes known value aliases without changing their stored values', () => {
	expect(formatAttributeValue('zh-tw', 'NON_STERILE')).toBe('非無菌');
	expect(formatAttributeValue('zh-tw', 'high_density_polyethylene')).toBe('高密度聚乙烯');
	expect(formatAttributeValue('en', 'PTFE')).toBe('PTFE');
});

test('humanizes unknown keys and preserves unknown values verbatim', () => {
	expect(formatAttributeKey('zh-tw', 'customField_name')).toBe('Custom Field Name');
	expect(formatAttributeKey('en', 'USBPort')).toBe('USB Port');
	expect(formatAttributeValue('zh-tw', 'USB-C / LAN')).toBe('USB-C / LAN');
	expect(formatAttributeValue('en', 'USB-C / LAN')).toBe('USB-C / LAN');
});
