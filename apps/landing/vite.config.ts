import adapter from '@sveltejs/adapter-cloudflare';
import { relative, sep } from 'node:path';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const cookieDomain = env['PUBLIC_COOKIE_DOMAIN']?.trim() ?? '';
	const contactOrigin = new URL(env['PUBLIC_CONTACT_WORKER_URL']?.trim() || 'http://localhost:8787')
		.origin as
		`${string}://${string}.${string}` | `${string}://localhost` | `${string}://localhost:${number}`;

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				alias: { $lib: './src/lib' },
				compilerOptions: {
					// defaults to rune mode for the project, except for `node_modules`. Can be removed in svelte 6.
					runes: ({ filename }) => {
						const relativePath = relative(import.meta.dirname, filename);
						const pathSegments = relativePath.toLowerCase().split(sep);
						const isExternalLibrary = pathSegments.includes('node_modules');

						return isExternalLibrary ? undefined : true;
					}
				},
				adapter: adapter(),
				csp: {
					mode: 'hash',
					directives: {
						'default-src': ['self'],
						'script-src': ['self', 'https://challenges.cloudflare.com'],
						'script-src-attr': ['none'],
						'style-src': ['self', 'unsafe-inline'],
						'img-src': ['self', 'data:', 'blob:', 'https:'],
						'font-src': ['self', 'data:'],
						'connect-src': ['self', contactOrigin, 'https://challenges.cloudflare.com'],
						'frame-src': ['https://challenges.cloudflare.com', 'https://www.google.com'],
						'worker-src': ['self', 'blob:'],
						'object-src': ['none'],
						'base-uri': ['self'],
						'form-action': ['self'],
						'frame-ancestors': ['none'],
						'manifest-src': ['self']
					}
				},
				prerender: {
					entries: ['*', '/en/', '/en/about/', '/en/contact/'],
					handleHttpError: ({ path, status, message }) => {
						if (
							status === 404 &&
							(path.startsWith('/landing/') || path.startsWith('/logo-') || path === '/favicon.ico')
						) {
							return;
						}

						throw new Error(message);
					}
				}
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
				thresholds: { lines: 52, branches: 58, functions: 53 }
			},
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'client',
						setupFiles: ['./tests/browser-setup.ts'],
						browser: {
							enabled: true,
							provider: playwright(),
							instances: [{ browser: 'chromium', headless: true }]
						},
						include: ['tests/**/*.svelte.{test,spec}.{js,ts}']
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
