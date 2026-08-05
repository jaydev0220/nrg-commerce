import { assetUrl, CATALOG_ASSETS } from '$lib/assets';
import * as m from '$lib/paraglide/messages';
import { localeFromPathname } from '$lib/catalog/query.js';
import { localizeValue } from '$lib/catalog/ui.js';
import { createSeoPageData } from '@packages/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data, url }) => {
	const locale = localeFromPathname(url.pathname);
	const categoryName = localizeValue(locale, data.category.name, data.category.nameEn);
	const categoryDescription =
		localizeValue(locale, data.category.description, data.category.descriptionEn) ??
		m.catalog_category_meta_description({ categoryName });

	return {
		...data,
		seoBreadcrumbItems: [
			{ name: m.catalog_title(), pathname: '/' },
			{ name: categoryName, pathname: `/categories/${data.category.slug}` }
		],
		...createSeoPageData({
			title: m.catalog_category_meta_title({ categoryName }),
			description: categoryDescription,
			pageType: 'CollectionPage',
			openGraphImage: assetUrl(CATALOG_ASSETS.galleryOpenGraph),
			openGraphImageAlt: categoryName
		})
	};
};
