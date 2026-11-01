import type { SeoPageData } from '@packages/seo';

declare global {
	namespace App {
		interface PageData {
			seo?: SeoPageData;
		}
	}
}

export {};
