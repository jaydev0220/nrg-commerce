import type { SeoPageData } from '@packages/seo';

declare global {
	namespace App {
		interface PageData {
			seo?: SeoPageData;
		}

		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}
	}
}

export {};
