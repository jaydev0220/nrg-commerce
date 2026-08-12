import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildAlternateLinks,
	buildSeoConfig,
	buildStructuredData,
	createSeoPageData,
	type ResolveLocalizedUrl
} from '../src/index.js';

const resolveLocalizedUrl: ResolveLocalizedUrl = (pathname, locale) => {
	const localizedPathname = locale === 'en' ? `/en${pathname === '/' ? '' : pathname}` : pathname;
	return new URL(localizedPathname, 'https://catalog.example.com');
};

const seoPage = createSeoPageData({
	title: 'Precision Beakers',
	description: 'Lab-grade glassware for industrial and education use.',
	pageType: 'CollectionPage',
	openGraphImage: 'https://cdn.example.com/landing/products-beakers.webp',
	openGraphImageAlt: 'Glass beakers arranged on a white backdrop'
}).seo;

test('createSeoPageData returns the shared SEO payload shape', () => {
	assert.deepEqual(seoPage, {
		title: 'Precision Beakers',
		description: 'Lab-grade glassware for industrial and education use.',
		pageType: 'CollectionPage',
		openGraphImage: 'https://cdn.example.com/landing/products-beakers.webp',
		openGraphImageAlt: 'Glass beakers arranged on a white backdrop'
	});
});

test('buildSeoConfig resolves canonical metadata and locale-specific Open Graph fields', () => {
	const config = buildSeoConfig({
		seo: seoPage,
		pathname: '/products',
		locale: 'en',
		siteName: 'NRG Instruments',
		siteOrigin: 'https://catalog.example.com',
		resolveLocalizedUrl
	});

	assert.equal(config.url, 'https://catalog.example.com/en/products');
	assert.equal(config.website, 'https://catalog.example.com/');
	assert.equal(config.language, 'en_US');
	assert.equal(config.site_name, 'NRG Instruments');
});

test('buildAlternateLinks returns the supported localized variants and x-default link', () => {
	const alternateLinks = buildAlternateLinks({
		pathname: '/products/precision-beakers',
		resolveLocalizedUrl
	});

	assert.deepEqual(alternateLinks, [
		{
			hreflang: 'zh-TW',
			href: 'https://catalog.example.com/products/precision-beakers'
		},
		{
			hreflang: 'en',
			href: 'https://catalog.example.com/en/products/precision-beakers'
		},
		{
			hreflang: 'x-default',
			href: 'https://catalog.example.com/products/precision-beakers'
		}
	]);
});

test('buildStructuredData emits organization, website, page, and breadcrumb nodes', () => {
	const schema = buildStructuredData({
		seo: seoPage,
		pathname: '/products/precision-beakers',
		locale: 'zh-tw',
		siteOrigin: 'https://catalog.example.com',
		organizationUrl: 'https://www.nrglabware.com',
		resolveLocalizedUrl,
		logoUrl: 'https://cdn.example.com/logo-light.svg',
		organization: {
			name: 'NEW GLATEC Co., Ltd.',
			legalName: '巧新有限公司',
			alternateName: 'New Glatec',
			brandName: 'NRG Glass',
			description: 'Laboratory glassware manufacturer in Taiwan.',
			address: 'No. 1, Industrial Road, Hsinchu',
			telephone: '+886-3-123-4567',
			fax: '+886-3-123-9999',
			email: 'sales@example.com'
		},
		sameAs: ['https://www.facebook.com/example', 'https://line.me/ti/p/example'],
		breadcrumbItems: [
			{
				name: 'Products',
				pathname: '/products'
			}
		],
		mainEntityOrganization: true
	}) as Record<string, unknown>[];

	assert.equal(schema.length, 4);

	const [organizationNode, websiteNode, pageNode, breadcrumbNode] = schema;

	assert.ok(organizationNode);
	assert.ok(websiteNode);
	assert.ok(pageNode);
	assert.ok(breadcrumbNode);

	assert.equal(organizationNode['@type'], 'Organization');
	assert.equal(organizationNode['@id'], 'https://www.nrglabware.com/#organization');
	assert.equal(organizationNode['name'], 'NEW GLATEC Co., Ltd.');
	assert.equal(organizationNode['legalName'], '巧新有限公司');
	assert.equal(organizationNode['alternateName'], 'New Glatec');
	assert.deepEqual(organizationNode['brand'], { '@type': 'Brand', name: 'NRG Glass' });
	assert.equal(organizationNode['url'], 'https://www.nrglabware.com/');
	assert.deepEqual(organizationNode['sameAs'], [
		'https://www.facebook.com/example',
		'https://line.me/ti/p/example'
	]);
	assert.equal(websiteNode['@type'], 'WebSite');
	assert.equal(websiteNode['@id'], 'https://catalog.example.com/#website');
	assert.deepEqual(websiteNode['publisher'], {
		'@id': 'https://www.nrglabware.com/#organization'
	});
	assert.equal(pageNode['@type'], 'CollectionPage');
	assert.deepEqual(pageNode['about'], {
		'@id': 'https://www.nrglabware.com/#organization'
	});
	assert.deepEqual(pageNode['mainEntity'], {
		'@id': 'https://www.nrglabware.com/#organization'
	});
	assert.equal(breadcrumbNode['@type'], 'BreadcrumbList');
});

test('buildStructuredData omits sameAs and breadcrumbs when they are not supplied', () => {
	const schema = buildStructuredData({
		seo: seoPage,
		pathname: '/',
		locale: 'en',
		siteOrigin: 'https://catalog.example.com/',
		resolveLocalizedUrl,
		logoUrl: 'https://cdn.example.com/logo-light.svg',
		organization: {
			name: 'NRG Instruments',
			description: 'Laboratory glassware manufacturer in Taiwan.',
			address: 'No. 1, Industrial Road, Hsinchu',
			telephone: '+886-3-123-4567',
			fax: '+886-3-123-9999',
			email: 'sales@example.com'
		}
	}) as Record<string, unknown>[];

	assert.equal(schema.length, 3);
	assert.ok(schema[0]);
	assert.equal('sameAs' in schema[0], false);
});

test('SEO URLs can enforce a trailing-slash policy without changing the default behavior', () => {
	const config = buildSeoConfig({
		seo: seoPage,
		pathname: '/about',
		locale: 'en',
		siteName: 'NRG Instruments',
		siteOrigin: 'https://landing.example.com',
		resolveLocalizedUrl,
		trailingSlash: 'always'
	});
	const alternateLinks = buildAlternateLinks({
		pathname: '/about',
		resolveLocalizedUrl,
		trailingSlash: 'always'
	});

	assert.equal(config.url, 'https://catalog.example.com/en/about/');
	assert.equal(alternateLinks[0]?.href, 'https://catalog.example.com/about/');
	assert.equal(alternateLinks[1]?.href, 'https://catalog.example.com/en/about/');
});

test('SEO URLs can remove trailing slashes while preserving the site root', () => {
	const config = buildSeoConfig({
		seo: seoPage,
		pathname: '/about/',
		locale: 'zh-tw',
		siteName: 'NRG Instruments',
		siteOrigin: 'https://catalog.example.com',
		resolveLocalizedUrl,
		trailingSlash: 'never'
	});
	const rootLinks = buildAlternateLinks({
		pathname: '/',
		resolveLocalizedUrl,
		trailingSlash: 'never'
	});

	assert.equal(config.url, 'https://catalog.example.com/about');
	assert.equal(rootLinks[0]?.href, 'https://catalog.example.com/');
});
