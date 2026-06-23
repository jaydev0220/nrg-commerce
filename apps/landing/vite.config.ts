import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const cookieDomain = env['PUBLIC_COOKIE_DOMAIN']?.trim() ?? '';

	return {
		plugins: [
			tailwindcss(),
			sveltekit(),
			paraglideVitePlugin({
				project: './project.inlang',
				outdir: './src/lib/paraglide',
				strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
				cookieName: 'locale',
				cookieDomain
			})
		]
	};
});
