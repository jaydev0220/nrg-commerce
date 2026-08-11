import type { CatalogProductRecord, CatalogSkuRecord } from '$lib/catalog/types.js';

const timestamp = '2026-07-01T00:00:00.000Z';

function createSku(
	id: string,
	skuCode: string,
	price: number,
	attributes: CatalogSkuRecord['attributes'],
	availability: CatalogSkuRecord['availability'] = 'in_stock'
): CatalogSkuRecord {
	return {
		id,
		productId: '00000000-0000-4000-8000-000000000001',
		productSlug: 'laboratory-beaker',
		skuCode,
		name: `實驗室燒杯 ${skuCode}`,
		nameEn: `Laboratory Beaker ${skuCode}`,
		description: null,
		descriptionEn: null,
		categoryId: '00000000-0000-4000-8000-000000000010',
		categorySlug: 'beakers',
		price,
		availability,
		published: true,
		attributes,
		deletedAt: null,
		createdAt: timestamp,
		updatedAt: timestamp,
		images: []
	};
}

export function createProductFixture(
	skus: CatalogSkuRecord[] = [
		createSku('00000000-0000-4000-8000-000000000101', 'BEAKER-100', 100, {
			volume: '100 ml',
			material: 'glass'
		}),
		createSku(
			'00000000-0000-4000-8000-000000000102',
			'BEAKER-250',
			250,
			{ volume: '250 ml', material: 'glass' },
			'out_of_stock'
		)
	]
): CatalogProductRecord {
	return {
		id: '00000000-0000-4000-8000-000000000001',
		slug: 'laboratory-beaker',
		name: '實驗室燒杯',
		nameEn: 'Laboratory Beaker',
		description: '耐用的實驗室玻璃燒杯。',
		descriptionEn: 'Durable laboratory glass beaker.',
		categoryId: '00000000-0000-4000-8000-000000000010',
		categorySlug: 'beakers',
		published: true,
		deletedAt: null,
		createdAt: timestamp,
		updatedAt: timestamp,
		thumbnail: null,
		images: [],
		skus
	};
}

export function createSkuFixture(
	id: string,
	skuCode: string,
	price: number,
	attributes: CatalogSkuRecord['attributes']
) {
	return createSku(id, skuCode, price, attributes);
}
