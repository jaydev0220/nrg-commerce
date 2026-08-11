import { PUBLIC_SITE_URL } from '$env/static/public';
import { staticPagePaths } from '$lib/seo/static-routes';
import type { RequestHandler } from './$types';

export const prerender = true;

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function localizedUrl(origin: string, pathname: string, locale: 'zh-tw' | 'en'): string {
	const localizedPath = locale === 'en' ? `/en${pathname}` : pathname;
	return new URL(localizedPath, origin).toString();
}

function renderEntry(origin: string, pathname: string): string {
	const zhUrl = localizedUrl(origin, pathname, 'zh-tw');
	const enUrl = localizedUrl(origin, pathname, 'en');
	const alternates = `<xhtml:link rel="alternate" hreflang="zh-TW" href="${escapeXml(zhUrl)}"/><xhtml:link rel="alternate" hreflang="en" href="${escapeXml(enUrl)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(zhUrl)}"/>`;

	return `<url><loc>${escapeXml(zhUrl)}</loc>${alternates}</url>\n<url><loc>${escapeXml(enUrl)}</loc>${alternates}</url>`;
}

export const GET: RequestHandler = ({ url }) => {
	const siteOrigin = PUBLIC_SITE_URL.trim() || url.origin;
	const entries = staticPagePaths.map((pathname) => renderEntry(siteOrigin, pathname)).join('\n');

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>`,
		{
			headers: {
				'content-type': 'application/xml; charset=utf-8',
				'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
			}
		}
	);
};
