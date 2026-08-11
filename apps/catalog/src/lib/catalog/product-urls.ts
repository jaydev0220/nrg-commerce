import type { CatalogProductRecord } from './types.js';

export type ProductVariantUrlState = {
	canonicalPathname: string;
	invalidSkuQuery: boolean;
	robots: 'index,follow' | 'noindex,follow';
	selectedSkuCode: string | null;
};

export function resolveProductVariantUrlState(
	url: URL,
	product: Pick<CatalogProductRecord, 'skus'>
): ProductVariantUrlState {
	const requestedSkuCodes = url.searchParams.getAll('sku');
	if (requestedSkuCodes.length === 0) {
		return {
			canonicalPathname: url.pathname,
			invalidSkuQuery: false,
			robots: url.search ? 'noindex,follow' : 'index,follow',
			selectedSkuCode: null
		};
	}

	const requestedSkuCode = requestedSkuCodes.length === 1 ? requestedSkuCodes[0] : '';
	const selectedSku = requestedSkuCode
		? product.skus.find((sku) => sku.skuCode === requestedSkuCode)
		: undefined;
	if (!selectedSku) {
		return {
			canonicalPathname: url.pathname,
			invalidSkuQuery: true,
			robots: 'noindex,follow',
			selectedSkuCode: null
		};
	}

	const canonicalSearch = new URLSearchParams({ sku: selectedSku.skuCode });
	return {
		canonicalPathname: `${url.pathname}?${canonicalSearch}`,
		invalidSkuQuery: false,
		robots: url.searchParams.size === 1 ? 'index,follow' : 'noindex,follow',
		selectedSkuCode: selectedSku.skuCode
	};
}
