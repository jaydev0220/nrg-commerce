import { staticPagePaths } from '$lib/seo/static-routes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const pageLabels: Record<(typeof staticPagePaths)[number], string> = {
		'/': 'Catalog',
		'/inquiry': 'Inquiry'
	};
	const pageLinks = staticPagePaths
		.flatMap((pathname) => [
			`- ${pageLabels[pathname]}: ${new URL(pathname, url.origin)}`,
			`- English ${pageLabels[pathname].toLowerCase()}: ${new URL(`/en${pathname === '/' ? '/' : pathname}`, url.origin)}`
		])
		.join('\n');
	return new Response(
		`# NRG Glass Product Catalog\n\nThis site presents NRG Glass laboratory glassware product families, categories, specifications, and SKUs.\n\n## Pages\n${pageLinks}\n\n## Discovery\nThe sitemap is authoritative for the complete set of canonical localized category, product, and SKU URLs.\n${new URL('/sitemap.xml', url.origin)}\n`,
		{
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'public, max-age=300, stale-while-revalidate=86400'
			}
		}
	);
};
