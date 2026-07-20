import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '@packages/seo';
import { CDN_ASSETS, cdnUrl } from '$lib/utils/cdn';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	createSeoPageData({
		title: m.about_meta_title(),
		description: m.about_meta_description(),
		pageType: 'AboutPage',
		openGraphImage: cdnUrl(CDN_ASSETS.aboutOpenGraph),
		openGraphImageAlt: m.about_page_title()
	});
