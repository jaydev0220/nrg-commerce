import type { SeoPageData } from '$lib/seo';

declare global {
	namespace App {
		interface PageData {
			seo?: SeoPageData;
		}
	}
}

export {};
