import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: { baseURL: 'http://127.0.0.1:4178' },
	webServer: {
		command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4178',
		port: 4178,
		env: {
			NODE_ENV: 'production',
			PUBLIC_CDN_BASE_URL: 'https://cdn.example.test',
			PUBLIC_CONTACT_WORKER_URL: 'http://127.0.0.1:4178/api-e2e',
			PUBLIC_COOKIE_DOMAIN: '',
			PUBLIC_CTA_URL: 'https://catalog.example.test',
			PUBLIC_FACEBOOK_URL: 'https://www.facebook.com/example',
			PUBLIC_LINE_URL: 'https://line.me/ti/p/example',
			PUBLIC_SITE_URL: 'http://127.0.0.1:4178',
			PUBLIC_TURNSTILE_SITE_KEY: 'e2e-site-key'
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
