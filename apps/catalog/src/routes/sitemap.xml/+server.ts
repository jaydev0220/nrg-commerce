import {
	fetchCatalogSitemapCategories,
	fetchCatalogSitemapProducts,
	fetchCatalogSitemapSkus
} from '$lib/server/catalog-api.js';
import { staticPagePaths } from '$lib/seo/static-routes';
import type { RequestHandler } from './$types';

function escapeXml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function localizedUrl(origin: string, pathname: string, locale: 'zh-tw' | 'en') {
	const localizedPath = locale === 'en' ? (pathname === '/' ? '/en/' : `/en${pathname}`) : pathname;
	return new URL(localizedPath, origin).toString();
}

function renderEntry(origin: string, pathname: string, lastModified?: string) {
	const zhUrl = localizedUrl(origin, pathname, 'zh-tw');
	const enUrl = localizedUrl(origin, pathname, 'en');
	return `<url><loc>${escapeXml(zhUrl)}</loc><xhtml:link rel="alternate" hreflang="zh-TW" href="${escapeXml(zhUrl)}"/><xhtml:link rel="alternate" hreflang="en" href="${escapeXml(enUrl)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(zhUrl)}"/>${lastModified ? `<lastmod>${escapeXml(lastModified)}</lastmod>` : ''}</url>\n<url><loc>${escapeXml(enUrl)}</loc><xhtml:link rel="alternate" hreflang="zh-TW" href="${escapeXml(zhUrl)}"/><xhtml:link rel="alternate" hreflang="en" href="${escapeXml(enUrl)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(zhUrl)}"/>${lastModified ? `<lastmod>${escapeXml(lastModified)}</lastmod>` : ''}</url>`;
}

function latestTimestamp(...values: Array<string | undefined>) {
	const timestamps = values.flatMap((value) => (value ? [Date.parse(value)] : []));
	return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : undefined;
}

export const GET: RequestHandler = async ({ fetch, url }) => {
	try {
		const [products, skus, categories] = await Promise.all([
			fetchCatalogSitemapProducts(fetch),
			fetchCatalogSitemapSkus(fetch),
			fetchCatalogSitemapCategories(fetch)
		]);
		const productUpdatedAt = new Map(
			products.map((product) => [product.slug, product.updatedAt] as const)
		);
		const entries = [
			...staticPagePaths.map((pathname) => renderEntry(url.origin, pathname)),
			...categories.map((category) =>
				renderEntry(
					url.origin,
					`/categories/${encodeURIComponent(category.slug)}`,
					category.updatedAt
				)
			),
			...products.map((product) =>
				renderEntry(url.origin, `/${encodeURIComponent(product.slug)}`, product.updatedAt)
			),
			...skus.map((sku) =>
				renderEntry(
					url.origin,
					`/${encodeURIComponent(sku.productSlug)}?${new URLSearchParams({ sku: sku.skuCode })}`,
					latestTimestamp(productUpdatedAt.get(sku.productSlug), sku.updatedAt)
				)
			)
		].join('\n');
		return new Response(
			`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>`,
			{
				headers: {
					'content-type': 'application/xml; charset=utf-8',
					'cache-control': 'public, max-age=300, stale-while-revalidate=86400, stale-if-error=86400'
				}
			}
		);
	} catch {
		return new Response('Sitemap temporarily unavailable.', {
			status: 503,
			headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' }
		});
	}
};
