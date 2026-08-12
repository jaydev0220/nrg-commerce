import { assetUrl, LANDING_ASSETS } from '$lib/assets';
import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '@packages/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	createSeoPageData({
		title: m.privacy_meta_title(),
		description: m.privacy_meta_description(),
		pageType: 'WebPage',
		openGraphImage: assetUrl(LANDING_ASSETS.privacyOpenGraph),
		openGraphImageAlt: m.privacy_page_title()
	});
