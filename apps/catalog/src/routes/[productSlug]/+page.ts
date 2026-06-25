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
		m.catalog_description();
	const openGraphImage =
		data.product.skus.flatMap((sku) => sku.images)[0]?.imageUrl ??
		catalogCdnUrl('/landing/products-beakers.webp');

	return {
		...data,
		...createSeoPageData({
			title: localizedName,
			description: localizedDescription,
			pageType: 'WebPage',
			openGraphImage,
			openGraphImageAlt: localizedName
		})
	};
};
