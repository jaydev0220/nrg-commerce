import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '$lib/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	createSeoPageData({
		routeId: 'about',
		title: m.about_meta_title(),
		description: m.about_meta_description(),
		openGraphImageAlt: m.about_page_title()
	});
