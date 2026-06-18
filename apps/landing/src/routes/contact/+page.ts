import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '$lib/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	createSeoPageData({
		routeId: 'contact',
		title: m.contact_meta_title(),
		description: m.contact_meta_description(),
		openGraphImageAlt: m.contact_page_title()
	});
