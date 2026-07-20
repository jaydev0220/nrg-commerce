import { assetUrl, LANDING_ASSETS } from '$lib/assets';
import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '@packages/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	createSeoPageData({
		title: m.contact_meta_title(),
		description: m.contact_meta_description(),
		pageType: 'ContactPage',
		openGraphImage: assetUrl(LANDING_ASSETS.contactOpenGraph),
		openGraphImageAlt: m.contact_page_title()
	});
