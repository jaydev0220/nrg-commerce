import { PUBLIC_CDN_BASE_URL } from '$env/static/public';
import { parseInquiryQueryState } from '$lib/catalog/query.js';
import * as m from '$lib/paraglide/messages';
import { createSeoPageData } from '@packages/seo';
import type { PageLoad } from './$types';

const cdnBaseUrl = PUBLIC_CDN_BASE_URL.trim();

function catalogCdnUrl(path: string): string {
	if (!cdnBaseUrl) {
		return path;
	}

	return new URL(path, cdnBaseUrl).toString();
}

export const load: PageLoad = ({ url }) => ({
	...parseInquiryQueryState(url.searchParams),
	...createSeoPageData({
		title: m.inquiry_meta_title(),
		description: m.inquiry_meta_description(),
		pageType: 'ContactPage',
		openGraphImage: catalogCdnUrl('/og/catalog/inquiry.webp'),
		openGraphImageAlt: m.inquiry_title()
	})
});
