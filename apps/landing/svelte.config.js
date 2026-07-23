import adapter from '@sveltejs/adapter-cloudflare';
import { relative, sep } from 'node:path';

/**
 * @param {string} value
 * @returns {`${string}://${string}.${string}` | `${string}://localhost` | `${string}://localhost:${number}`}
 */
function toOrigin(value) {
	return /** @type {`${string}://${string}.${string}` | `${string}://localhost` | `${string}://localhost:${number}`} */ (
		new URL(value).origin
	);
}

const contactOrigin = toOrigin(
	process.env['PUBLIC_CONTACT_WORKER_URL']?.trim() || 'http://localhost:8787'
);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// defaults to rune mode for the project, except for `node_modules`. Can be removed in svelte 6.
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');

			return isExternalLibrary ? undefined : true;
		}
	},
	kit: {
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
	}
};

export default config;
