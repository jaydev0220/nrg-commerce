import type {
	CatalogCategoryNode,
	CatalogCategoryRecord,
	CatalogImageRecord,
	CatalogProductRecord,
	CatalogSkuRecord
} from '$lib/catalog/types.js';

const timestamp = '2026-06-19T00:00:00.000Z';

function createPreviewImage(
	id: string,
	skuId: string,
	label: string,
	tone: string,
	position: number,
	type: CatalogImageRecord['type']
): CatalogImageRecord {
	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" fill="none">
			<rect width="1200" height="900" fill="${tone}" />
			<rect x="120" y="120" width="960" height="660" rx="36" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.45)" stroke-width="6" />
			<text x="600" y="420" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="72" font-weight="700">${label}</text>
			<text x="600" y="500" text-anchor="middle" fill="rgba(255,255,255,0.86)" font-family="Arial, sans-serif" font-size="28">NRG preview image</text>
		</svg>
	`;

	return {
		altText: `${label} preview`,
		assetKey: null,
		createdAt: timestamp,
		deletedAt: null,
		id,
		imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
		position,
		skuId,
		type,
		updatedAt: timestamp
	};
}

function createSku(
	product: Pick<CatalogProductRecord, 'id' | 'slug' | 'categoryId' | 'categorySlug'>,
	config: {
		id: string;
		skuCode: string;
		name: string;
		nameEn: string;
		description?: string;
		descriptionEn?: string;
		price: number;
		attributes: CatalogSkuRecord['attributes'];
		imageLabels: Array<{
			id: string;
			label: string;
			tone: string;
			type: CatalogImageRecord['type'];
		}>;
	}
): CatalogSkuRecord {
	return {
		attributes: config.attributes,
		categoryId: product.categoryId,
		categorySlug: product.categorySlug,
		createdAt: timestamp,
		deletedAt: null,
		description: config.description ?? null,
		descriptionEn: config.descriptionEn ?? null,
		id: config.id,
		images: config.imageLabels.map((image, index) =>
			createPreviewImage(image.id, config.id, image.label, image.tone, index, image.type)
		),
		name: config.name,
		nameEn: config.nameEn,
		price: config.price,
		productId: product.id,
		productSlug: product.slug,
		published: true,
		skuCode: config.skuCode,
		updatedAt: timestamp
	};
}

const categories: CatalogCategoryNode[] = [
	{
		children: [
			{
				children: [],
				createdAt: timestamp,
				deletedAt: null,
				description: '適用於移液作業與自動化工作站的吸頭與配件。',
				descriptionEn: 'Tips and accessories for pipetting workflows and automation lines.',
				id: 'cat-pipette-tips',
				name: '移液吸頭',
				nameEn: 'Pipette Tips',
				parentId: 'cat-liquid-handling',
				position: 1,
				productCount: 2,
				slug: 'pipette-tips',
				updatedAt: timestamp
			},
			{
				children: [],
				createdAt: timestamp,
				deletedAt: null,
				description: '適用於多道分液與試劑儲存的儲液槽。',
				descriptionEn: 'Reservoir formats for multichannel dispensing and reagent staging.',
				id: 'cat-reservoirs',
				name: '儲液槽',
				nameEn: 'Reservoirs',
				parentId: 'cat-liquid-handling',
				position: 2,
				productCount: 1,
				slug: 'reservoirs',
				updatedAt: timestamp
			}
		],
		createdAt: timestamp,
		deletedAt: null,
		description: '液體處理相關耗材與模組。',
		descriptionEn: 'Consumables and modules for liquid handling workflows.',
		id: 'cat-liquid-handling',
		name: '液體處理',
		nameEn: 'Liquid Handling',
		parentId: null,
		position: 1,
		productCount: 3,
		slug: 'liquid-handling',
		updatedAt: timestamp
	},
	{
		children: [
			{
				children: [],
				createdAt: timestamp,
				deletedAt: null,
				description: '具備良好光學表現與培養適性的微孔板。',
				descriptionEn: 'Microplates tuned for optical readout and cell culture handling.',
				id: 'cat-microplates',
				name: '微孔板',
				nameEn: 'Microplates',
				parentId: 'cat-sample-prep',
				position: 1,
				productCount: 1,
				slug: 'microplates',
				updatedAt: timestamp
			}
		],
		createdAt: timestamp,
		deletedAt: null,
		description: '樣本前處理與分析前使用耗材。',
		descriptionEn: 'Consumables for sample preparation and assay setup.',
		id: 'cat-sample-prep',
		name: '樣本前處理',
		nameEn: 'Sample Preparation',
		parentId: null,
		position: 2,
		productCount: 1,
		slug: 'sample-preparation',
		updatedAt: timestamp
	}
];

const products: CatalogProductRecord[] = [
	{
		categoryId: 'cat-pipette-tips',
		categorySlug: 'pipette-tips',
		createdAt: timestamp,
		deletedAt: null,
		description: '適用於高通量移液流程的通用型吸頭系列，提供不同容量、無菌與包裝規格。',
		descriptionEn:
			'A universal tip family for high-throughput liquid handling with volume, sterility, and pack-size variants.',
		id: 'prod-precision-tip',
		name: 'PrecisionTip 通用吸頭',
		nameEn: 'PrecisionTip Universal Tips',
		published: true,
		skus: [],
		slug: 'precisiontip-universal-tips',
		updatedAt: timestamp
	},
	{
		categoryId: 'cat-pipette-tips',
		categorySlug: 'pipette-tips',
		createdAt: timestamp,
		deletedAt: null,
		description: '低吸附濾芯吸頭，降低樣品殘留並提供氣膠阻隔。',
		descriptionEn:
			'Low-retention filter tips that reduce sample carryover and add aerosol protection.',
		id: 'prod-aeroshield-tip',
		name: 'AeroShield 濾芯吸頭',
		nameEn: 'AeroShield Filter Tips',
		published: true,
		skus: [],
		slug: 'aeroshield-filter-tips',
		updatedAt: timestamp
	},
	{
		categoryId: 'cat-reservoirs',
		categorySlug: 'reservoirs',
		createdAt: timestamp,
		deletedAt: null,
		description: '適合多道移液與自動化供液的試劑槽，提供不同槽數與表面處理。',
		descriptionEn:
			'Reagent reservoirs for multichannel pipetting and automated dispensing with multiple cavity formats.',
		id: 'prod-flowdeck-reservoir',
		name: 'FlowDeck 多槽儲液槽',
		nameEn: 'FlowDeck Multi-Well Reservoir',
		published: true,
		skus: [],
		slug: 'flowdeck-multi-well-reservoir',
		updatedAt: timestamp
	},
	{
		categoryId: 'cat-microplates',
		categorySlug: 'microplates',
		createdAt: timestamp,
		deletedAt: null,
		description: '適用於螢光與吸光分析的 96 孔微孔板。',
		descriptionEn: 'A 96-well plate family for fluorescence and absorbance workflows.',
		id: 'prod-signalplate-96',
		name: 'SignalPlate 96 微孔板',
		nameEn: 'SignalPlate 96 Microplate',
		published: true,
		skus: [],
		slug: 'signalplate-96-microplate',
		updatedAt: timestamp
	}
];

products[0]!.skus = [
	createSku(products[0]!, {
		attributes: {
			format: 'rack',
			sterility: 'sterile',
			volume: '200 uL'
		},
		id: 'sku-precisiontip-200-sterile-rack',
		imageLabels: [
			{
				id: 'img-precisiontip-200-rack-thumb',
				label: '200 uL Rack',
				tone: '#0D7A8C',
				type: 'thumbnail'
			},
			{
				id: 'img-precisiontip-200-rack-gallery',
				label: 'Sterile Rack',
				tone: '#1A93A6',
				type: 'gallery'
			}
		],
		name: 'PrecisionTip 200uL 無菌盒裝',
		nameEn: 'PrecisionTip 200uL Sterile Rack',
		price: 168,
		skuCode: 'PT-200-SR'
	}),
	createSku(products[0]!, {
		attributes: {
			format: 'bulk',
			sterility: 'non-sterile',
			volume: '1000 uL'
		},
		id: 'sku-precisiontip-1000-bulk',
		imageLabels: [
			{
				id: 'img-precisiontip-1000-bulk-thumb',
				label: '1000 uL Bulk',
				tone: '#074450',
				type: 'thumbnail'
			},
			{
				id: 'img-precisiontip-1000-bulk-gallery',
				label: 'Bulk Pack',
				tone: '#0A5D6B',
				type: 'gallery'
			}
		],
		name: 'PrecisionTip 1000uL 散裝',
		nameEn: 'PrecisionTip 1000uL Bulk Pack',
		price: 214,
		skuCode: 'PT-1000-B'
	})
];

products[1]!.skus = [
	createSku(products[1]!, {
		attributes: {
			filter: 'yes',
			sterility: 'sterile',
			volume: '20 uL'
		},
		id: 'sku-aeroshield-20-filter',
		imageLabels: [
			{
				id: 'img-aeroshield-20-thumb',
				label: '20 uL Filter',
				tone: '#3F8CFF',
				type: 'thumbnail'
			},
			{
				id: 'img-aeroshield-20-gallery',
				label: 'Low Retention',
				tone: '#5A9BFF',
				type: 'gallery'
			}
		],
		name: 'AeroShield 20uL 無菌濾芯',
		nameEn: 'AeroShield 20uL Sterile Filter',
		price: 196,
		skuCode: 'AS-020-SF'
	}),
	createSku(products[1]!, {
		attributes: {
			filter: 'yes',
			sterility: 'sterile',
			volume: '200 uL'
		},
		id: 'sku-aeroshield-200-filter',
		imageLabels: [
			{
				id: 'img-aeroshield-200-thumb',
				label: '200 uL Filter',
				tone: '#2B6FD6',
				type: 'thumbnail'
			}
		],
		name: 'AeroShield 200uL 無菌濾芯',
		nameEn: 'AeroShield 200uL Sterile Filter',
		price: 228,
		skuCode: 'AS-200-SF'
	})
];

products[2]!.skus = [
	createSku(products[2]!, {
		attributes: {
			cavities: '12',
			material: 'polypropylene',
			surface: 'standard'
		},
		id: 'sku-flowdeck-12-standard',
		imageLabels: [
			{
				id: 'img-flowdeck-12-thumb',
				label: '12 Cavity',
				tone: '#6A4C93',
				type: 'thumbnail'
			},
			{
				id: 'img-flowdeck-12-gallery',
				label: 'Automation',
				tone: '#7C5AA8',
				type: 'gallery'
			}
		],
		name: 'FlowDeck 12 槽標準型',
		nameEn: 'FlowDeck 12-Cavity Standard',
		price: 142,
		skuCode: 'FD-12-ST'
	}),
	createSku(products[2]!, {
		attributes: {
			cavities: '24',
			material: 'polypropylene',
			surface: 'low-bind'
		},
		id: 'sku-flowdeck-24-lowbind',
		imageLabels: [
			{
				id: 'img-flowdeck-24-thumb',
				label: '24 Cavity',
				tone: '#5B3F7D',
				type: 'thumbnail'
			}
		],
		name: 'FlowDeck 24 槽低吸附型',
		nameEn: 'FlowDeck 24-Cavity Low-Bind',
		price: 198,
		skuCode: 'FD-24-LB'
	})
];

products[3]!.skus = [
	createSku(products[3]!, {
		attributes: {
			bottom: 'clear',
			coating: 'cell-grade',
			format: '96-well'
		},
		id: 'sku-signalplate-clear',
		imageLabels: [
			{
				id: 'img-signalplate-clear-thumb',
				label: 'Clear Bottom',
				tone: '#C46C2B',
				type: 'thumbnail'
			},
			{
				id: 'img-signalplate-clear-gallery',
				label: 'Cell Grade',
				tone: '#D88749',
				type: 'gallery'
			}
		],
		name: 'SignalPlate 透明底細胞培養型',
		nameEn: 'SignalPlate Clear-Bottom Cell Grade',
		price: 176,
		skuCode: 'SP96-CB'
	}),
	createSku(products[3]!, {
		attributes: {
			bottom: 'black',
			coating: 'assay-ready',
			format: '96-well'
		},
		id: 'sku-signalplate-black',
		imageLabels: [
			{
				id: 'img-signalplate-black-thumb',
				label: 'Black Plate',
				tone: '#915124',
				type: 'thumbnail'
			}
		],
		name: 'SignalPlate 黑色分析型',
		nameEn: 'SignalPlate Black Assay Plate',
		price: 188,
		skuCode: 'SP96-BK'
	})
];

const categoryBySlug = new Map<string, CatalogCategoryRecord>();

for (const category of categories) {
	categoryBySlug.set(category.slug, category);
	for (const child of category.children) {
		categoryBySlug.set(child.slug, child);
	}
}

const productBySlug = new Map(products.map((product) => [product.slug, product]));

export function getCatalogPreviewIndexData(): {
	products: CatalogProductRecord[];
	categories: CatalogCategoryNode[];
} {
	return {
		categories,
		products
	};
}

export function getCatalogPreviewProductBySlug(productSlug: string): CatalogProductRecord | null {
	return productBySlug.get(productSlug) ?? null;
}

export function getCatalogPreviewCategoryBySlug(
	categorySlug: string
): CatalogCategoryRecord | null {
	return categoryBySlug.get(categorySlug) ?? null;
}
