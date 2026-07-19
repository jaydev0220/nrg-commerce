import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const cookieDomain = env['PUBLIC_COOKIE_DOMAIN']?.trim() ?? '';

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter()
			}),
			paraglideVitePlugin({
				project: './project.inlang',
				outdir: './src/lib/paraglide',
				strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
				cookieName: 'locale',
				cookieDomain
			})
		],
		test: {
			expect: { requireAssertions: true },
			coverage: {
				provider: 'v8',
				reporter: ['text'],
				include: ['src/**/*.{js,ts,svelte}'],
				exclude: ['src/**/*.d.ts', 'src/lib/paraglide/**'],
				thresholds: { lines: 56, branches: 39, functions: 58 }
			},
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'client',
						browser: {
							enabled: true,
							provider: playwright(),
							instances: [{ browser: 'chromium', headless: true }]
						},
						include: ['tests/**/*.svelte.{test,spec}.{js,ts}'],
						exclude: ['tests/lib/server/**']
					}
				},

				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['tests/**/*.{test,spec}.{js,ts}'],
						exclude: ['tests/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	};
});
