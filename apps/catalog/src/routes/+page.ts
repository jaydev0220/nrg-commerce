import { PUBLIC_CDN_BASE_URL } from '$env/static/public';
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

export const load: PageLoad = ({ data }) => ({
	...data,
	...createSeoPageData({
		title: m.catalog_title(),
		description: m.catalog_description(),
		pageType: 'CollectionPage',
		openGraphImage: catalogCdnUrl('/landing/products-beakers.webp'),
		openGraphImageAlt: m.catalog_title()
	})
});
