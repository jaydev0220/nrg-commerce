import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '$lib/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	createSeoPageData({
		routeId: 'home',
		title: m.home_meta_title(),
		description: m.home_meta_description(),
		openGraphImageAlt: m.home_meta_title()
	});
