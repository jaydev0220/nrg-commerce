import { assetUrl, CATALOG_ASSETS } from '$lib/assets';
import * as m from '$lib/paraglide/messages';
import { localeFromPathname } from '$lib/catalog/query.js';
import { localizeValue } from '$lib/catalog/ui.js';
import { createSeoPageData } from '@packages/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data, url }) => {
	const locale = localeFromPathname(url.pathname);
	const localizedName = localizeValue(locale, data.product.name, data.product.nameEn);
	const localizedTitle = m.product_meta_title({ productName: localizedName });
	const localizedDescription =
		localizeValue(locale, data.product.description, data.product.descriptionEn) ??
		m.product_meta_description({ productName: localizedName });
	const openGraphImage =
		data.product.skus.find((sku) => sku.skuCode === data.selectedSkuCode)?.images[0]?.imageUrl ??
		data.product.thumbnail?.imageUrl ??
		assetUrl(CATALOG_ASSETS.galleryOpenGraph);

	return {
		...data,
		seoBreadcrumbItems: [
			{ name: m.catalog_title(), pathname: '/' },
			...(data.category
				? [
						{
							name: localizeValue(locale, data.category.name, data.category.nameEn),
							pathname: `/categories/${data.category.slug}`
						}
					]
				: [])
		],
		...createSeoPageData({
			title: localizedTitle,
			description: localizedDescription,
			pageType: 'WebPage',
			openGraphImage,
			openGraphImageAlt: localizedName
		}),
		productStructuredDataInput: {
			brandName: m.company_name(),
			categoryName: data.category
				? localizeValue(locale, data.category.name, data.category.nameEn)
				: null,
			description: localizedDescription,
			locale,
			productName: localizedName,
			productUrl: `${url.origin}${url.pathname}`
		}
	};
};
