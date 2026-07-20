import { expect, test } from 'vitest';

import {
	createProductConfigurationModel,
	deriveCatalogProductView,
	filterCatalogProducts,
	getFirstImageForSku,
	getProductGalleryImages,
	resolveCategorySlugScope
} from '$lib/catalog/logic.js';
import type { CatalogCategoryNode, CatalogProductRecord } from '$lib/catalog/types.js';

function createCategoryTree(): CatalogCategoryNode[] {
	return [
		{
			id: 'category-measurement',
			name: '量測儀器',
			nameEn: 'Measurement',
			slug: 'measurement',
			description: null,
			descriptionEn: null,
			position: 0,
			parentId: null,
			deletedAt: null,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
			productCount: 2,
			children: [
				{
					id: 'category-electrical',
					name: '電氣量測',
					nameEn: 'Electrical',
					slug: 'electrical',
					description: null,
					descriptionEn: null,
					position: 0,
					parentId: 'category-measurement',
					deletedAt: null,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z',
					productCount: 1,
					children: []
				},
				{
					id: 'category-environmental',
					name: '環境量測',
					nameEn: 'Environmental',
					slug: 'environmental',
					description: null,
					descriptionEn: null,
					position: 1,
					parentId: 'category-measurement',
					deletedAt: null,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z',
					productCount: 1,
					children: []
				}
			]
		}
	];
}

function createProducts(): CatalogProductRecord[] {
	const thumbnail = {
		id: 'image-1',
		productId: 'product-1',
		skuId: null,
		imageUrl: 'https://assets.example.com/product-1/front.png',
		assetKey: 'products/product-1/front.png',
		altText: 'Front image',
		placement: 'thumbnail' as const,
		position: 0,
		deletedAt: null,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z'
	};
	return [
		{
			id: 'product-1',
			slug: 'bench-multimeter-700',
			name: '桌上型數位萬用電表 700 系列',
			nameEn: 'Bench Multimeter 700 Series',
			description: '適用於驗證與生產測試流程。',
			descriptionEn: 'Suitable for validation and production workflows.',
			categoryId: 'category-electrical',
			categorySlug: 'electrical',
			published: true,
			deletedAt: null,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
			thumbnail,
			images: [thumbnail],
			skus: [
				{
					id: 'sku-1',
					productId: 'product-1',
					productSlug: 'bench-multimeter-700',
					skuCode: 'NL-DMM-720',
					name: '桌上型數位萬用電表 700 系列',
					nameEn: 'Bench Multimeter 700 Series',
					description: '適用於驗證與生產測試流程。',
					descriptionEn: 'Suitable for validation and production workflows.',
					categoryId: 'category-electrical',
					categorySlug: 'electrical',
					price: 689,
					availability: 'in_stock',
					published: true,
					attributes: {
						Resolution: '6½ digit',
						Interface: 'USB-C / LAN',
						Calibration: 'Standard'
					},
					deletedAt: null,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z',
					images: [
						{
							id: 'image-1',
							productId: 'product-1',
							skuId: 'sku-1',
							imageUrl: 'https://assets.example.com/sku-1/front.png',
							assetKey: 'products/skus/sku-1/front.png',
							altText: 'Front image',
							placement: 'sku-gallery',
							position: 0,
							deletedAt: null,
							createdAt: '2026-01-01T00:00:00.000Z',
							updatedAt: '2026-01-01T00:00:00.000Z'
						}
					]
				},
				{
					id: 'sku-2',
					productId: 'product-1',
					productSlug: 'bench-multimeter-700',
					skuCode: 'NL-DMM-750',
					name: '桌上型數位萬用電表 700 系列',
					nameEn: 'Bench Multimeter 700 Series',
					description: '適用於驗證與生產測試流程。',
					descriptionEn: 'Suitable for validation and production workflows.',
					categoryId: 'category-electrical',
					categorySlug: 'electrical',
					price: 989,
					availability: 'out_of_stock',
					published: true,
					attributes: {
						Resolution: '7½ digit',
						Interface: 'USB-C / LAN',
						Calibration: 'Accredited'
					},
					deletedAt: null,
					createdAt: '2026-01-02T00:00:00.000Z',
					updatedAt: '2026-01-02T00:00:00.000Z',
					images: []
				}
			]
		},
		{
			id: 'product-2',
			slug: 'thermal-imager-240',
			name: '熱影像儀 240 系列',
			nameEn: 'Thermal Imager 240 Series',
			description: '適用於設備檢查與建築診斷。',
			descriptionEn: 'Used for inspection and building diagnostics.',
			categoryId: 'category-environmental',
			categorySlug: 'environmental',
			published: true,
			deletedAt: null,
			createdAt: '2026-01-03T00:00:00.000Z',
			updatedAt: '2026-01-03T00:00:00.000Z',
			thumbnail: null,
			images: [],
			skus: [
				{
					id: 'sku-3',
					productId: 'product-2',
					productSlug: 'thermal-imager-240',
					skuCode: 'NL-THM-240',
					name: '熱影像儀 240 系列',
					nameEn: 'Thermal Imager 240 Series',
					description: '適用於設備檢查與建築診斷。',
					descriptionEn: 'Used for inspection and building diagnostics.',
					categoryId: 'category-environmental',
					categorySlug: 'environmental',
					price: 1240,
					availability: 'in_stock',
					published: true,
					attributes: {
						Detector: '240 × 180 px',
						Lens: '45°',
						Range: '−20–550 °C'
					},
					deletedAt: null,
					createdAt: '2026-01-03T00:00:00.000Z',
					updatedAt: '2026-01-03T00:00:00.000Z',
					images: []
				}
			]
		}
	];
}

test('resolveCategorySlugScope includes descendant category slugs', () => {
	const scope = resolveCategorySlugScope(createCategoryTree(), 'measurement');

	expect(scope).toEqual(new Set(['measurement', 'electrical', 'environmental']));
});

test('filterCatalogProducts matches nested SKU content without duplicating product profiles', () => {
	const categories = createCategoryTree();
	const products = createProducts();
	const filtered = filterCatalogProducts(products, categories, {
		locale: 'zh-tw',
		query: 'NL-DMM-720',
		categorySlug: null,
		sort: 'featured',
		page: 1
	});

	expect(filtered).toHaveLength(1);
	expect(filtered[0]?.slug).toBe('bench-multimeter-700');
});

test('filterCatalogProducts includes descendant categories and preserves price sorting', () => {
	const categories = createCategoryTree();
	const products = createProducts();
	const filtered = filterCatalogProducts(products, categories, {
		locale: 'zh-tw',
		query: '',
		categorySlug: 'measurement',
		sort: 'price-asc',
		page: 1
	});

	expect(filtered.map((product) => product.slug)).toEqual([
		'bench-multimeter-700',
		'thermal-imager-240'
	]);
});

test('deriveCatalogProductView computes representative price and image fallback', () => {
	const view = deriveCatalogProductView(createProducts()[0]!, 'en');

	expect(view.minimumPrice).toBe(689);
	expect(view.maximumPrice).toBe(989);
	expect(view.skuCount).toBe(2);
	expect(view.representativeImage?.imageUrl).toBe('https://assets.example.com/product-1/front.png');
});

test('getProductGalleryImages keeps product images in stable order across SKU changes', () => {
	const source = createProducts()[0]!;
	const skuImage = {
		id: 'image-2',
		productId: source.id,
		skuId: 'sku-2',
		imageUrl: 'https://assets.example.com/sku-2/front.png',
		assetKey: 'products/product-1/sku-2-front.png',
		altText: 'SKU 2 front image',
		placement: 'sku-gallery' as const,
		position: 1,
		deletedAt: null,
		createdAt: '2026-01-02T00:00:00.000Z',
		updatedAt: '2026-01-02T00:00:00.000Z'
	};
	const product = {
		...source,
		images: [...source.images, skuImage]
	};

	expect(getProductGalleryImages(product).map((image) => image.id)).toEqual(['image-1', 'image-2']);
	expect(getFirstImageForSku(product, 'sku-2')?.id).toBe('image-2');
});

test('createProductConfigurationModel localizes option labels and resolves invalid combinations', () => {
	const product = createProducts()[0]!;
	const model = createProductConfigurationModel(product, 'en', {
		Resolution: '6½ digit',
		Interface: 'USB-C / LAN',
		Calibration: 'Accredited'
	});

	expect(model.activeSku.skuCode).toBe('NL-DMM-750');
	expect(model.selectedAttributes['Resolution']).toBe('7½ digit');
	expect(
		model.optionGroups
			.find((group) => group.key === 'Calibration')
			?.options.find((option) => option.value === 'Standard')?.available
	).toBe(false);
	expect(
		model.optionGroups
			.find((group) => group.key === 'Calibration')
			?.options.find((option) => option.value === 'Accredited')?.selected
	).toBe(true);
	expect(model.optionGroups.find((group) => group.key === 'Calibration')?.label).toBe(
		'Calibration'
	);
	expect(
		model.selectedAttributeEntries.find((entry) => entry.key === 'Calibration')?.valueLabel
	).toBe('Accredited');
});

test('createProductConfigurationModel translates preview attribute labels for zh-tw', () => {
	const product = createProducts()[1]!;
	const model = createProductConfigurationModel(product, 'zh-tw');

	expect(model.optionGroups.find((group) => group.key === 'Detector')?.label).toBe('感測器');
	expect(model.selectedAttributeEntries.find((entry) => entry.key === 'Range')?.label).toBe(
		'量測範圍'
	);
});
