import type { MockCategory, MockProduct, MockProductImage, MockSku } from '../state.js';
import { archivedTime, fixtureTime, ids } from './ids.js';

export function createCategoryFixtures(): MockCategory[] {
	return [
		{
			id: ids.categoryLab,
			name: '實驗室用品',
			nameEn: 'Laboratory',
			slug: 'laboratory',
			description: '常用實驗室器材',
			descriptionEn: 'Common laboratory equipment.',
			position: 0,
			parentId: null,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.categoryBeakers,
			name: '燒杯',
			nameEn: 'Beakers',
			slug: 'beakers',
			description: null,
			descriptionEn: null,
			position: 0,
			parentId: ids.categoryLab,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.categoryFunnels,
			name: '漏斗',
			nameEn: 'Funnels',
			slug: 'funnels',
			description: null,
			descriptionEn: null,
			position: 1,
			parentId: ids.categoryLab,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.categoryArchived,
			name: '封存分類',
			nameEn: 'Archived Category',
			slug: 'archived-category',
			description: null,
			descriptionEn: null,
			position: 2,
			parentId: null,
			deletedAt: archivedTime,
			createdAt: fixtureTime,
			updatedAt: archivedTime
		}
	];
}

export function createProductFixtures(): MockProduct[] {
	return [
		{
			id: ids.productBeaker,
			slug: 'laboratory-beaker',
			name: '實驗室燒杯',
			nameEn: 'Laboratory Beaker',
			description: '耐熱玻璃燒杯',
			descriptionEn: 'Heat-resistant glass beaker.',
			notes: 'Handle with care.',
			baseUnit: 'piece',
			categoryId: ids.categoryBeakers,
			published: true,
			deletedAt: null,
			createdAt: new Date('2026-07-19T02:00:00.000Z'),
			updatedAt: fixtureTime
		},
		{
			id: ids.productFunnel,
			slug: 'glass-funnel',
			name: '玻璃漏斗',
			nameEn: 'Glass Funnel',
			description: '實驗室玻璃漏斗',
			descriptionEn: 'Laboratory glass funnel.',
			notes: null,
			baseUnit: null,
			categoryId: ids.categoryFunnels,
			published: true,
			deletedAt: null,
			createdAt: new Date('2026-07-18T02:00:00.000Z'),
			updatedAt: fixtureTime
		},
		{
			id: ids.productDraft,
			slug: 'draft-measuring-cylinder',
			name: '量筒草稿',
			nameEn: 'Draft Measuring Cylinder',
			description: null,
			descriptionEn: null,
			notes: null,
			baseUnit: null,
			categoryId: ids.categoryLab,
			published: false,
			deletedAt: null,
			createdAt: new Date('2026-07-17T02:00:00.000Z'),
			updatedAt: fixtureTime
		},
		{
			id: ids.productArchived,
			slug: 'archived-product',
			name: '封存商品',
			nameEn: 'Archived Product',
			description: null,
			descriptionEn: null,
			notes: null,
			baseUnit: null,
			categoryId: null,
			published: false,
			deletedAt: archivedTime,
			createdAt: new Date('2026-07-16T02:00:00.000Z'),
			updatedAt: archivedTime
		}
	];
}

export function createSkuFixtures(): MockSku[] {
	return [
		{
			id: ids.skuBeaker100,
			productId: ids.productBeaker,
			skuCode: 'BEAKER-100',
			price: 120,
			stockQuantity: 24,
			attributes: { volume: '100 ml' },
			notes: 'Fragile glass.',
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.skuBeaker250,
			productId: ids.productBeaker,
			skuCode: 'BEAKER-250',
			price: 180,
			stockQuantity: 0,
			attributes: { volume: '250 ml' },
			notes: null,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.skuFunnel75,
			productId: ids.productFunnel,
			skuCode: 'FUNNEL-75',
			price: 90,
			stockQuantity: 12,
			attributes: { diameter: '75 mm' },
			notes: null,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.skuDraft,
			productId: ids.productDraft,
			skuCode: 'CYLINDER-100',
			price: 240,
			stockQuantity: 5,
			attributes: { volume: '100 ml' },
			notes: null,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.skuArchived,
			productId: ids.productArchived,
			skuCode: 'ARCHIVED-001',
			price: 50,
			stockQuantity: 0,
			attributes: {},
			notes: null,
			deletedAt: archivedTime,
			createdAt: fixtureTime,
			updatedAt: archivedTime
		}
	];
}

export function createImageFixtures(): MockProductImage[] {
	return [
		{
			id: ids.imageBeakerThumb,
			productId: ids.productBeaker,
			skuId: null,
			imageUrl: 'https://mock.invalid/fixtures/beaker.svg',
			assetKey: 'fixture:beaker.svg',
			altText: 'Laboratory beaker',
			placement: 'thumbnail',
			position: 0,
			focusX: 0.5,
			focusY: 0.5,
			zoom: 1,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.imageBeakerGallery,
			productId: ids.productBeaker,
			skuId: ids.skuBeaker250,
			imageUrl: 'https://mock.invalid/fixtures/beaker-detail.svg',
			assetKey: 'fixture:beaker-detail.svg',
			altText: 'Beaker 250 ml detail',
			placement: 'sku-gallery',
			position: 0,
			focusX: null,
			focusY: null,
			zoom: null,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.imageFunnelThumb,
			productId: ids.productFunnel,
			skuId: null,
			imageUrl: 'https://mock.invalid/fixtures/funnel.svg',
			assetKey: 'fixture:funnel.svg',
			altText: 'Glass funnel',
			placement: 'thumbnail',
			position: 0,
			focusX: 0.5,
			focusY: 0.5,
			zoom: 1,
			deletedAt: null,
			createdAt: fixtureTime,
			updatedAt: fixtureTime
		},
		{
			id: ids.imageDeleted,
			productId: ids.productBeaker,
			skuId: null,
			imageUrl: 'https://mock.invalid/fixtures/deleted.svg',
			assetKey: 'fixture:deleted.svg',
			altText: 'Deleted beaker image',
			placement: 'shared-gallery',
			position: 1,
			focusX: null,
			focusY: null,
			zoom: null,
			deletedAt: archivedTime,
			createdAt: fixtureTime,
			updatedAt: archivedTime
		}
	];
}
