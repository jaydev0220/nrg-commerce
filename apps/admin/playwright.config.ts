import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		env: {
			NODE_ENV: 'production',
			PUBLIC_API_BASE_URL: 'http://127.0.0.1:4174'
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
