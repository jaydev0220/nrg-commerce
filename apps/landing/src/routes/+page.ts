import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '@packages/seo';
import { CDN_ASSETS, cdnUrl } from '$lib/utils/cdn';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	createSeoPageData({
		title: m.home_meta_title(),
		description: m.home_meta_description(),
		pageType: 'WebPage',
		openGraphImage: cdnUrl(CDN_ASSETS.brandingOpenGraph),
		openGraphImageAlt: m.home_meta_title()
	});
