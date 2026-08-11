import { PUBLIC_SITE_URL } from '$env/static/public';
import { staticPagePaths } from '$lib/seo/static-routes';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = ({ url }) => {
	const siteOrigin = PUBLIC_SITE_URL.trim() || url.origin;
	const labels: Record<(typeof staticPagePaths)[number], string> = {
		'/': 'Home',
		'/about/': 'About',
		'/contact/': 'Contact'
	};
	const pageLinks = staticPagePaths
		.flatMap((pathname) => [
			`- ${labels[pathname]}: ${new URL(pathname, siteOrigin)}`,
			`- English ${labels[pathname].toLowerCase()}: ${new URL(`/en${pathname}`, siteOrigin)}`
		])
		.join('\n');
	return new Response(
		`# NRG Glass\n\nNRG Glass manufactures scientific and laboratory glassware for professional buyers.\n\n## Pages\n${pageLinks}\n\n## Languages\nThe site is available in Traditional Chinese and English.\n\n## Sitemap\nThe sitemap is authoritative for the complete set of canonical localized URLs.\n${new URL('/sitemap.xml', siteOrigin)}\n`,
		{
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
			}
		}
	);
};
