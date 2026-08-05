import { PUBLIC_SITE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = ({ url }) => {
	const siteOrigin = PUBLIC_SITE_URL.trim() || url.origin;
	return new Response(
		`User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', siteOrigin)}\n`,
		{
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
			}
		}
	);
};
