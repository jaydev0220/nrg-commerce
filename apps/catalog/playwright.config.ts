import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: { baseURL: 'http://127.0.0.1:4175' },
	webServer: [
		{
			command: 'node e2e/fixtures/mock-storefront-api.mjs',
			port: 4174
		},
		{
			command:
				'pnpm build && pnpm exec wrangler dev .svelte-kit/cloudflare/_worker.js --port 4175 --var PUBLIC_API_BASE_URL:http://127.0.0.1:4174',
			port: 4175
		}
	],
	testMatch: '**/*.e2e.{ts,js}'
});
