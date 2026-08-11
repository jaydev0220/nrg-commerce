import { describe, expect, it } from 'vitest';

import { buildProductStructuredData } from '$lib/catalog/product-seo.js';
import { createProductFixture, createSkuFixture } from '../../fixtures/product.js';

function schemaInput(selectedSkuCode: string | null = null) {
	return {
		brandName: 'NRG Glass',
		categoryName: 'Beakers',
		description: 'Durable laboratory glass beaker.',
		locale: 'en' as const,
		product: createProductFixture(),
		productName: 'Laboratory Beaker',
		productUrl: 'https://catalog.example.test/en/laboratory-beaker',
		selectedSkuCode
	};
}

function record(value: unknown) {
	return value as Record<string, unknown>;
}

describe('product structured data', () => {
	it('emits a ProductGroup with truthful size variants and deep offer URLs', () => {
		const schema = record(buildProductStructuredData(schemaInput()));
		const variants = schema['hasVariant'] as Array<Record<string, unknown>>;

		expect(schema['@type']).toBe('ProductGroup');
		expect(schema['variesBy']).toEqual(['https://schema.org/size']);
		expect(variants).toHaveLength(2);
		expect(variants[0]?.['size']).toBe('100 ml');
		expect(record(variants[0]?.['offers'])['url']).toBe(
			'https://catalog.example.test/en/laboratory-beaker?sku=BEAKER-100'
		);
		expect(variants[0]?.['additionalProperty']).toEqual([
			{ '@type': 'PropertyValue', name: 'material', value: 'glass' }
		]);
	});

	it('describes the SSR-selected SKU and references its stable group', () => {
		const schema = record(buildProductStructuredData(schemaInput('BEAKER-250')));
		const offer = record(schema['offers']);
		const group = record(schema['isVariantOf']);

		expect(schema['@type']).toBe('Product');
		expect(schema['sku']).toBe('BEAKER-250');
		expect(schema['size']).toBe('250 ml');
		expect(offer['price']).toBe(250);
		expect(offer['availability']).toBe('https://schema.org/OutOfStock');
		expect(offer['url']).toBe('https://catalog.example.test/en/laboratory-beaker?sku=BEAKER-250');
		expect(group['@type']).toBe('ProductGroup');
		expect(group['variesBy']).toEqual(['https://schema.org/size']);
	});

	it('combines multiple dimensional keys into deterministic size text', () => {
		const product = createProductFixture([
			createSkuFixture('00000000-0000-4000-8000-000000000101', 'BEAKER-S', 100, {
				volume: '100 ml',
				diameter: '50 mm'
			}),
			createSkuFixture('00000000-0000-4000-8000-000000000102', 'BEAKER-L', 250, {
				volume: '250 ml',
				diameter: '75 mm'
			})
		]);
		const schema = record(buildProductStructuredData({ ...schemaInput(), product }));
		const variants = schema['hasVariant'] as Array<Record<string, unknown>>;

		expect(variants[0]?.['size']).toBe('volume: 100 ml; diameter: 50 mm');
	});

	it('falls back to the default Product when no supported dimension varies', () => {
		const product = createProductFixture([
			createSkuFixture('00000000-0000-4000-8000-000000000101', 'BEAKER-A', 100, {
				material: 'glass'
			}),
			createSkuFixture('00000000-0000-4000-8000-000000000102', 'BEAKER-B', 250, {
				material: 'glass'
			})
		]);
		const schema = record(buildProductStructuredData({ ...schemaInput(), product }));

		expect(schema['@type']).toBe('Product');
		expect(schema['sku']).toBe('BEAKER-A');
		expect(schema).not.toHaveProperty('hasVariant');
		expect(record(schema['offers'])['url']).toBe(
			'https://catalog.example.test/en/laboratory-beaker'
		);
	});
});
