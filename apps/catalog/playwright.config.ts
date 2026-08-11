import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: { baseURL: 'http://127.0.0.1:4175' },
	webServer: [
		{
			command: 'pnpm --dir ../../tools/mock-api exec tsx src/index.ts --scenario e2e --port 4174',
			port: 4174
		},
		{
			command:
				'pnpm build && pnpm exec wrangler dev .svelte-kit/cloudflare/_worker.js --port 4175 --inspector-port 9232 --var PUBLIC_API_BASE_URL:http://127.0.0.1:4174',
			port: 4175,
			env: {
				NODE_ENV: 'production',
				PUBLIC_HOME_URL: 'https://www.nrglabware.com'
			}
		}
	],
	testMatch: '**/*.e2e.{ts,js}'
});
