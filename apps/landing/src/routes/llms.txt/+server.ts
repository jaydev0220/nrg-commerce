import { PUBLIC_SITE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = ({ url }) => {
	const siteOrigin = PUBLIC_SITE_URL.trim() || url.origin;
	return new Response(
		`# NRG Glass\n\nNRG Glass manufactures scientific and laboratory glassware for professional buyers.\n\n## Pages\n- Home: ${new URL('/', siteOrigin)}\n- About: ${new URL('/about/', siteOrigin)}\n- Contact: ${new URL('/contact/', siteOrigin)}\n- English home: ${new URL('/en/', siteOrigin)}\n\n## Languages\nThe site is available in Traditional Chinese and English.\n\n## Sitemap\n${new URL('/sitemap.xml', siteOrigin)}\n`,
		{
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
			}
		}
	);
};
