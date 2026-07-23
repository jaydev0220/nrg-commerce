import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';

type CspHostSource =
	`${string}://${string}.${string}` | `${string}://localhost` | `${string}://localhost:${number}`;

function toOrigin(value: string): CspHostSource {
	return new URL(value).origin as CspHostSource;
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const cookieDomain = env['PUBLIC_COOKIE_DOMAIN']?.trim() ?? '';
	const apiOrigin = toOrigin(env['PUBLIC_API_BASE_URL']?.trim() || 'http://localhost:3000');
	const contactOrigin = toOrigin(
		env['PUBLIC_CONTACT_WORKER_URL']?.trim() || 'http://localhost:8787'
	);

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
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
						'connect-src': ['self', apiOrigin, contactOrigin, 'https://challenges.cloudflare.com'],
						'frame-src': ['https://challenges.cloudflare.com'],
						'worker-src': ['self', 'blob:'],
						'object-src': ['none'],
						'base-uri': ['self'],
						'form-action': ['self'],
						'frame-ancestors': ['none'],
						'manifest-src': ['self']
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
