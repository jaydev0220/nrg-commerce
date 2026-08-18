import type { SchemaOrgProps } from 'svead';
import type { StructuredDataFragment } from '@packages/product-structured-data';

import type { CatalogLocale, CatalogProductRecord, CatalogSkuRecord } from './types.js';

type ProductStructuredData = SchemaOrgProps['schema'];

type ProductSchemaInput = {
	brandName: string;
	categoryName: string | null;
	description: string;
	locale: CatalogLocale;
	product: CatalogProductRecord;
	productName: string;
	productUrl: string;
	selectedSkuCode: string | null;
};

type NormalizedDimensions = {
	color?: string;
	size?: string;
	material?: string;
	pattern?: string;
	suggestedAge?: string;
	suggestedGender?: string;
};

const structuredDimensionUrls = {
	color: 'https://schema.org/color',
	size: 'https://schema.org/size',
	material: 'https://schema.org/material',
	pattern: 'https://schema.org/pattern',
	suggestedAge: 'https://schema.org/suggestedAge',
	suggestedGender: 'https://schema.org/suggestedGender'
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fragmentForSku(sku: CatalogSkuRecord): StructuredDataFragment {
	return sku.structuredData ?? {};
}

function normalizeDimensions(sku: CatalogSkuRecord): NormalizedDimensions {
	const fragment = fragmentForSku(sku);
	return {
		...(fragment.color ? { color: fragment.color } : {}),
		...(fragment.size ? { size: fragment.size } : {}),
		...(fragment.material ? { material: fragment.material } : {}),
		...(fragment.pattern ? { pattern: fragment.pattern } : {}),
		...(fragment.audience?.suggestedAge ? { suggestedAge: fragment.audience.suggestedAge } : {}),
		...(fragment.audience?.suggestedGender
			? { suggestedGender: fragment.audience.suggestedGender }
			: {})
	};
}

function varyingDimensions(skus: CatalogSkuRecord[]) {
	return (Object.keys(structuredDimensionUrls) as Array<keyof NormalizedDimensions>).filter(
		(dimension) => {
			const values = skus.map((sku) => normalizeDimensions(sku)[dimension]);
			return values.every(Boolean) && new Set(values).size > 1;
		}
	);
}

function variantUrl(productUrl: string, skuCode: string) {
	const url = new URL(productUrl);
	url.search = new URLSearchParams({ sku: skuCode }).toString();
	return url.toString();
}

function productImages(product: CatalogProductRecord, sku: CatalogSkuRecord) {
	return [
		...sku.images.map((image) => image.imageUrl),
		...(product.thumbnail ? [product.thumbnail.imageUrl] : []),
		...product.images.map((image) => image.imageUrl)
	].filter((imageUrl, index, images) => images.indexOf(imageUrl) === index);
}

function createProductSchema({
	brandName,
	categoryName,
	description,
	groupReference,
	product,
	productName,
	sku,
	url
}: Omit<ProductSchemaInput, 'locale' | 'productUrl' | 'selectedSkuCode'> & {
	groupReference?: Record<string, unknown>;
	sku: CatalogSkuRecord;
	url: string;
}) {
	const fragment = fragmentForSku(sku);
	const { additionalProperty, ...specificMetadata } = fragment;
	const images = productImages(product, sku);

	return {
		'@type': 'Product',
		'@id': `${url}#product-${sku.id}`,
		sku: sku.skuCode,
		identifier: sku.skuCode,
		name: `${productName} - ${sku.skuCode}`,
		description,
		url,
		brand: { '@type': 'Brand', name: brandName },
		...(categoryName ? { category: categoryName } : {}),
		...(images.length > 0 ? { image: images } : {}),
		...specificMetadata,
		...(additionalProperty && additionalProperty.length > 0 ? { additionalProperty } : {}),
		...(groupReference ? { isVariantOf: groupReference } : {}),
		offers: {
			'@type': 'Offer',
			priceCurrency: 'TWD',
			price: sku.price,
			availability:
				sku.availability === 'in_stock'
					? 'https://schema.org/InStock'
					: 'https://schema.org/OutOfStock',
			url
		}
	};
}

function assertValidProductGraph(value: unknown): asserts value is ProductStructuredData {
	if (!isRecord(value) || (value['@type'] !== 'Product' && value['@type'] !== 'ProductGroup')) {
		throw new Error('The generated product structured-data graph is invalid.');
	}
	if (typeof value['url'] !== 'string' || !value['url'].startsWith('http')) {
		throw new Error('The generated product structured-data URL is invalid.');
	}
	if (value['@type'] === 'Product') {
		if (!isRecord(value['offers']) || typeof value['offers']['price'] !== 'number') {
			throw new Error('The generated product offer is invalid.');
		}
		return;
	}
	if (!Array.isArray(value['hasVariant']) || value['hasVariant'].length === 0) {
		throw new Error('The generated product group has no variants.');
	}
	if (!Array.isArray(value['variesBy']) || value['variesBy'].length === 0) {
		throw new Error('The generated product group has no varying dimensions.');
	}
}

export function buildProductStructuredData(input: ProductSchemaInput): ProductStructuredData {
	const { product, productUrl, selectedSkuCode } = input;
	const groupId = `${productUrl}#product-${product.id}`;
	const dimensions = varyingDimensions(product.skus);
	const variesBy = dimensions.map((dimension) => structuredDimensionUrls[dimension]);
	const selectedSku = selectedSkuCode
		? product.skus.find((sku) => sku.skuCode === selectedSkuCode)
		: undefined;

	if (selectedSku) {
		const selectedProduct = createProductSchema({
			...input,
			sku: selectedSku,
			url: variantUrl(productUrl, selectedSku.skuCode),
			...(variesBy.length > 0
				? {
						groupReference: {
							'@type': 'ProductGroup',
							'@id': groupId,
							productGroupID: product.id,
							name: input.productName,
							url: productUrl,
							variesBy
						}
					}
				: {})
		});
		assertValidProductGraph(selectedProduct);
		return selectedProduct as ProductStructuredData;
	}

	const defaultSku = product.skus[0];
	if (!defaultSku) throw new Error('A published product must include at least one SKU.');
	if (variesBy.length === 0) {
		const defaultProduct = createProductSchema({ ...input, sku: defaultSku, url: productUrl });
		assertValidProductGraph(defaultProduct);
		return defaultProduct as ProductStructuredData;
	}

	const groupImages = [
		...(product.thumbnail ? [product.thumbnail.imageUrl] : []),
		...product.images.map((image) => image.imageUrl)
	].filter((imageUrl, index, images) => images.indexOf(imageUrl) === index);
	const groupReference = { '@id': groupId };
	const group = {
		'@type': 'ProductGroup',
		'@id': groupId,
		productGroupID: product.id,
		name: input.productName,
		description: input.description,
		url: productUrl,
		brand: { '@type': 'Brand', name: input.brandName },
		...(input.categoryName ? { category: input.categoryName } : {}),
		...(groupImages.length > 0 ? { image: groupImages } : {}),
		variesBy,
		hasVariant: product.skus.map((sku) =>
			createProductSchema({
				...input,
				groupReference,
				sku,
				url: variantUrl(productUrl, sku.skuCode)
			})
		)
	};
	assertValidProductGraph(group as unknown);
	return group as ProductStructuredData;
}
