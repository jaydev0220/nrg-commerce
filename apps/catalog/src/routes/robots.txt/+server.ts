import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) =>
	new Response(`User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', url.origin)}\n`, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=300'
		}
	});
