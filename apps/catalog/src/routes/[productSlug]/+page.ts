import { PUBLIC_CDN_BASE_URL } from '$env/static/public';
import * as m from '$lib/paraglide/messages';
import { localeFromPathname } from '$lib/catalog/query.js';
import { localizeValue } from '$lib/catalog/ui.js';
import { createSeoPageData } from '@packages/seo';
import type { PageLoad } from './$types';

const cdnBaseUrl = PUBLIC_CDN_BASE_URL.trim();

function catalogCdnUrl(path: string): string {
	if (!cdnBaseUrl) {
		return path;
	}

	return new URL(path, cdnBaseUrl).toString();
}

export const load: PageLoad = ({ data, url }) => {
	const locale = localeFromPathname(url.pathname);
	const localizedName = localizeValue(locale, data.product.name, data.product.nameEn);
	const localizedDescription =
		localizeValue(locale, data.product.description, data.product.descriptionEn) ??
		m.product_meta_description({ productName: localizedName });
	const openGraphImage =
		data.product.thumbnail?.imageUrl ?? catalogCdnUrl('/og/catalog/gallery.webp');

	return {
		...data,
		...createSeoPageData({
			title: localizedName,
			description: localizedDescription,
			pageType: 'WebPage',
			openGraphImage,
			openGraphImageAlt: localizedName
		}),
		productStructuredData: {
			'@type': 'ProductGroup',
			'@id': `${url.origin}${url.pathname}#product`,
			name: localizedName,
			description: localizedDescription,
			url: `${url.origin}${url.pathname}`,
			...(data.product.thumbnail ? { image: data.product.thumbnail.imageUrl } : {}),
			hasVariant: data.product.skus.map((sku) => ({
				'@type': 'Product',
				sku: sku.skuCode,
				name: `${localizedName} - ${sku.skuCode}`,
				offers: {
					'@type': 'Offer',
					priceCurrency: 'TWD',
					price: sku.price,
					availability:
						sku.availability === 'in_stock'
							? 'https://schema.org/InStock'
							: 'https://schema.org/OutOfStock',
					url: `${url.origin}${url.pathname}`
				}
			}))
		}
	};
};
