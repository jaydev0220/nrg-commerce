import { assetUrl, CATALOG_ASSETS } from '$lib/assets';
import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '@packages/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
	...data,
	...createSeoPageData({
		title: m.catalog_meta_title(),
		description: m.catalog_meta_description(),
		pageType: 'CollectionPage',
		openGraphImage: assetUrl(CATALOG_ASSETS.galleryOpenGraph),
		openGraphImageAlt: m.catalog_title()
	})
});
