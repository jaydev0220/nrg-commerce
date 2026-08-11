import type { SchemaOrgProps } from 'svead';

import type {
	CatalogJsonValue,
	CatalogLocale,
	CatalogProductRecord,
	CatalogSkuRecord
} from './types.js';

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
	suggestedAge?: string;
	suggestedGender?: string;
};

const sizeAttributeKeys = ['size', 'volume', 'capacity', 'diameter', 'length', 'width', 'height'];
const supportedAttributeKeys = new Set([
	...sizeAttributeKeys,
	'color',
	'suggestedage',
	'suggestedgender'
]);
const structuredDimensionUrls = {
	color: 'https://schema.org/color',
	size: 'https://schema.org/size',
	suggestedAge: 'https://schema.org/suggestedAge',
	suggestedGender: 'https://schema.org/suggestedGender'
} as const;

function scalarText(value: CatalogJsonValue | undefined): string | null {
	if (typeof value === 'string') return value.trim() || null;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return null;
}

function normalizedAttributeMap(attributes: CatalogSkuRecord['attributes']) {
	return new Map(
		Object.entries(attributes).map(([key, value]) => [key.trim().toLowerCase(), value] as const)
	);
}

function normalizeDimensions(attributes: CatalogSkuRecord['attributes']): NormalizedDimensions {
	const normalized = normalizedAttributeMap(attributes);
	const sizeParts = sizeAttributeKeys.flatMap((key) => {
		const value = scalarText(normalized.get(key));
		return value ? [{ key, value }] : [];
	});
	const size =
		sizeParts.length === 1
			? sizeParts[0]?.value
			: sizeParts.map(({ key, value }) => `${key}: ${value}`).join('; ') || undefined;

	return {
		...(size ? { size } : {}),
		...(scalarText(normalized.get('color'))
			? { color: scalarText(normalized.get('color')) ?? undefined }
			: {}),
		...(scalarText(normalized.get('suggestedage'))
			? { suggestedAge: scalarText(normalized.get('suggestedage')) ?? undefined }
			: {}),
		...(scalarText(normalized.get('suggestedgender'))
			? { suggestedGender: scalarText(normalized.get('suggestedgender')) ?? undefined }
			: {})
	};
}

function varyingDimensions(skus: CatalogSkuRecord[]) {
	return (Object.keys(structuredDimensionUrls) as Array<keyof NormalizedDimensions>).filter(
		(dimension) => {
			const values = skus.map((sku) => normalizeDimensions(sku.attributes)[dimension]);
			return values.every(Boolean) && new Set(values).size > 1;
		}
	);
}

function additionalProperties(attributes: CatalogSkuRecord['attributes']) {
	const properties = Object.entries(attributes).flatMap(([name, rawValue]) => {
		if (supportedAttributeKeys.has(name.trim().toLowerCase())) return [];
		const value = scalarText(rawValue);
		return value ? [{ '@type': 'PropertyValue', name, value }] : [];
	});

	return properties.length > 0 ? properties : undefined;
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
	const dimensions = normalizeDimensions(sku.attributes);
	const images = productImages(product, sku);
	const properties = additionalProperties(sku.attributes);

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
		...dimensions,
		...(properties ? { additionalProperty: properties } : {}),
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

export function buildProductStructuredData(input: ProductSchemaInput): ProductStructuredData {
	const { product, productUrl, selectedSkuCode } = input;
	const groupId = `${productUrl}#product-${product.id}`;
	const dimensions = varyingDimensions(product.skus);
	const variesBy = dimensions.map((dimension) => structuredDimensionUrls[dimension]);
	const selectedSku = selectedSkuCode
		? product.skus.find((sku) => sku.skuCode === selectedSkuCode)
		: undefined;

	if (selectedSku) {
		return createProductSchema({
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
		}) as ProductStructuredData;
	}

	const defaultSku = product.skus[0];
	if (!defaultSku) throw new Error('A published product must include at least one SKU.');
	if (variesBy.length === 0) {
		return createProductSchema({
			...input,
			sku: defaultSku,
			url: productUrl
		}) as ProductStructuredData;
	}

	const groupImages = [
		...(product.thumbnail ? [product.thumbnail.imageUrl] : []),
		...product.images.map((image) => image.imageUrl)
	].filter((imageUrl, index, images) => images.indexOf(imageUrl) === index);
	const groupReference = { '@id': groupId };

	return {
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
	} as ProductStructuredData;
}
