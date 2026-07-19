import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: './wrangler.jsonc' }
		})
	],
	test: {
		expect: { requireAssertions: true },
		coverage: {
			provider: 'istanbul',
			reporter: ['text'],
			include: ['src/**/*.ts'],
			thresholds: { lines: 96, branches: 90, functions: 100 }
		}
	}
});
