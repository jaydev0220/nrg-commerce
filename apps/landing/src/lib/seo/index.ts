import { socialLinks } from '$lib/data/social';
import { CDN_ASSETS, cdnUrl } from '$lib/utils/cdn';
import { deLocalizeUrl, localizeUrl } from '$lib/paraglide/runtime';
import type { SchemaOrgProps, SeoConfig } from 'svead';

export type SupportedLocale = 'en' | 'zh-tw';
export type SeoPageType = 'WebPage' | 'AboutPage' | 'ContactPage';
export type SeoRouteId = 'home' | 'about' | 'contact';

interface SeoRouteConfig {
	pageType: SeoPageType;
	openGraphImage: string;
}

interface SeoPageInput {
	routeId: SeoRouteId;
	title: string;
	description: string;
	openGraphImageAlt: string;
}

export interface SeoPageData {
	routeId: SeoRouteId;
	title: string;
	description: string;
	pageType: SeoPageType;
	openGraphImage: string;
	openGraphImageAlt: string;
}

export interface SeoOrganizationData {
	name: string;
	description: string;
	address: string;
	telephone: string;
	fax: string;
	email: string;
}

const DEFAULT_SITE_URL = 'https://example.com';
type JsonLdNode = Record<string, unknown>;

const SEO_ROUTE_CONFIG: Record<SeoRouteId, SeoRouteConfig> = {
	home: {
		pageType: 'WebPage',
		openGraphImage: cdnUrl(CDN_ASSETS.productBeakers)
	},
	about: {
		pageType: 'AboutPage',
		openGraphImage: cdnUrl(CDN_ASSETS.companyStoryPhoto)
	},
	contact: {
		pageType: 'ContactPage',
		openGraphImage: cdnUrl(CDN_ASSETS.productHydrometers)
	}
};

const SCHEMA_LANGUAGES: Record<SupportedLocale, string> = {
	en: 'en',
	'zh-tw': 'zh-TW'
};

const OG_LOCALES: Record<SupportedLocale, string> = {
	en: 'en_US',
	'zh-tw': 'zh_TW'
};

function getSiteOrigin(): string {
	return new URL('/', import.meta.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL).href;
}

function getBaseUrl(pathname: string): URL {
	return deLocalizeUrl(new URL(pathname, getSiteOrigin()));
}

function getLocalizedUrl(pathname: string, locale: SupportedLocale): URL {
	return localizeUrl(getBaseUrl(pathname), { locale });
}

export function createSeoPageData({
	routeId,
	title,
	description,
	openGraphImageAlt
}: SeoPageInput) {
	return {
		seo: {
			routeId,
			title,
			description,
			openGraphImageAlt,
			...SEO_ROUTE_CONFIG[routeId]
		} satisfies SeoPageData
	};
}

export function getDefaultSeoPageData(
	title: string,
	description: string,
	openGraphImageAlt: string
) {
	return createSeoPageData({
		routeId: 'home',
		title,
		description,
		openGraphImageAlt
	}).seo;
}

export function buildSeoConfig(
	seo: SeoPageData,
	pathname: string,
	locale: SupportedLocale,
	siteName: string
): SeoConfig {
	return {
		title: seo.title,
		description: seo.description,
		url: getLocalizedUrl(pathname, locale).href,
		website: getSiteOrigin(),
		language: OG_LOCALES[locale],
		open_graph_image: seo.openGraphImage,
		open_graph_image_alt: seo.openGraphImageAlt,
		site_name: siteName,
		twitter_card_type: 'summary_large_image'
	};
}

export function buildAlternateLinks(pathname: string) {
	return [
		{ hreflang: 'zh-TW', href: getLocalizedUrl(pathname, 'zh-tw').href },
		{ hreflang: 'en', href: getLocalizedUrl(pathname, 'en').href },
		{ hreflang: 'x-default', href: getLocalizedUrl(pathname, 'zh-tw').href }
	] as const;
}

export function buildStructuredData(
	seo: SeoPageData,
	pathname: string,
	locale: SupportedLocale,
	organization: SeoOrganizationData,
	homeLabel: string
): SchemaOrgProps['schema'] {
	const siteUrl = getSiteOrigin();
	const canonicalUrl = getLocalizedUrl(pathname, locale).href;
	const localeHomeUrl = getLocalizedUrl('/', locale).href;
	const organizationId = `${siteUrl}#organization`;
	const websiteId = `${siteUrl}#website`;
	const inLanguage = SCHEMA_LANGUAGES[locale];

	const organizationSchema: JsonLdNode = {
		'@type': 'Organization',
		'@id': organizationId,
		name: organization.name,
		description: organization.description,
		url: siteUrl,
		logo: {
			'@type': 'ImageObject',
			url: cdnUrl(CDN_ASSETS.logoLight)
		},
		email: organization.email,
		telephone: organization.telephone,
		faxNumber: organization.fax,
		address: {
			'@type': 'PostalAddress',
			streetAddress: organization.address,
			addressCountry: 'TW'
		},
		contactPoint: [
			{
				'@type': 'ContactPoint',
				contactType: 'sales',
				telephone: organization.telephone,
				email: organization.email,
				availableLanguage: ['en', 'zh-TW'],
				areaServed: 'Worldwide'
			}
		],
		sameAs: socialLinks.map((social) => social.href)
	};

	const websiteSchema: JsonLdNode = {
		'@type': 'WebSite',
		'@id': websiteId,
		url: siteUrl,
		name: organization.name,
		description: organization.description,
		inLanguage,
		publisher: {
			'@id': organizationId
		}
	};

	const pageSchema: JsonLdNode = {
		'@type': seo.pageType,
		'@id': `${canonicalUrl}#page`,
		url: canonicalUrl,
		name: seo.title,
		description: seo.description,
		inLanguage,
		isPartOf: {
			'@id': websiteId
		},
		about: {
			'@id': organizationId
		},
		primaryImageOfPage: {
			'@type': 'ImageObject',
			url: seo.openGraphImage
		},
		...((seo.routeId === 'about' || seo.routeId === 'contact') && {
			mainEntity: {
				'@id': organizationId
			}
		})
	};

	const schemas: JsonLdNode[] = [organizationSchema, websiteSchema, pageSchema];

	if (seo.routeId !== 'home') {
		schemas.push({
			'@type': 'BreadcrumbList',
			'@id': `${canonicalUrl}#breadcrumb`,
			itemListElement: [
				{
					'@type': 'ListItem',
					position: 1,
					name: homeLabel,
					item: localeHomeUrl
				},
				{
					'@type': 'ListItem',
					position: 2,
					name: seo.title,
					item: canonicalUrl
				}
			]
		});
	}

	return schemas as SchemaOrgProps['schema'];
}
