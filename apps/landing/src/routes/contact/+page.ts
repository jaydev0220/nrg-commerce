import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '@packages/seo';
import { CDN_ASSETS, cdnUrl } from '$lib/utils/cdn';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	createSeoPageData({
		title: m.contact_meta_title(),
		description: m.contact_meta_description(),
		pageType: 'ContactPage',
		openGraphImage: cdnUrl(CDN_ASSETS.productHydrometers),
		openGraphImageAlt: m.contact_page_title()
	});
