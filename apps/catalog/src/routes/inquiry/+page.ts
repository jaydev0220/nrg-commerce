import { assetUrl, CATALOG_ASSETS } from '$lib/assets';
import { parseInquiryQueryState } from '$lib/catalog/query.js';
import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '@packages/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => ({
	...parseInquiryQueryState(url.searchParams),
	...createSeoPageData({
		title: m.inquiry_meta_title(),
		description: m.inquiry_meta_description(),
		pageType: 'ContactPage',
		openGraphImage: assetUrl(CATALOG_ASSETS.inquiryOpenGraph),
		openGraphImageAlt: m.inquiry_title()
	})
});
