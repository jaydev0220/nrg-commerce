import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	return new Response(
		`# NRG Glass Product Catalog\n\nThis site presents NRG Glass laboratory glassware product families, categories, specifications, and SKUs.\n\n## Pages\n- Catalog: ${new URL('/', url.origin)}\n- Inquiry: ${new URL('/inquiry', url.origin)}\n\n## Discovery\n${new URL('/sitemap.xml', url.origin)}\n`,
		{
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'public, max-age=300, stale-while-revalidate=86400'
			}
		}
	);
};
