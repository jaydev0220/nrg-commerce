import type { SchemaOrgProps, SeoConfig as SveadSeoConfig } from 'svead';

export type SupportedLocale = 'en' | 'zh-tw';
export type SeoPageType =
	| 'WebPage'
	| 'AboutPage'
	| 'ContactPage'
	| 'CollectionPage'
	| (string & {});

export type ResolveLocalizedUrl = (pathname: string, locale: SupportedLocale) => URL | string;

export type JsonLdNode = Record<string, unknown>;

export type SeoPageData = {
	title: string;
	description: string;
	pageType: SeoPageType;
	openGraphImage: string;
	openGraphImageAlt: string;
};

export type SeoOrganizationData = {
	name: string;
	description: string;
	address: string;
	telephone: string;
	fax: string;
	email: string;
	addressCountry?: string;
	availableLanguages?: string[];
	areaServed?: string;
};

export type SeoBreadcrumbItem = {
	name: string;
	pathname: string;
};

export type SeoConfig = SveadSeoConfig;

export type SeoAlternateLink = {
	hreflang: string;
	href: string;
};

const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['zh-tw', 'en'];

const SCHEMA_LANGUAGES: Record<SupportedLocale, string> = {
	en: 'en',
	'zh-tw': 'zh-TW'
};

const OG_LOCALES: Record<SupportedLocale, string> = {
	en: 'en_US',
	'zh-tw': 'zh_TW'
};

const HREFLANGS: Record<SupportedLocale, string> = {
	en: 'en',
	'zh-tw': 'zh-TW'
};

function normalizeSiteOrigin(siteOrigin: string): string {
	return new URL('/', siteOrigin).href;
}

function resolveUrl(
	resolveLocalizedUrl: ResolveLocalizedUrl,
	pathname: string,
	locale: SupportedLocale
): string {
	return new URL(resolveLocalizedUrl(pathname, locale).toString()).href;
}

export function createSeoPageData(seo: SeoPageData): { seo: SeoPageData } {
	return { seo };
}

export function buildSeoConfig({
	seo,
	pathname,
	locale,
	siteName,
	siteOrigin,
	resolveLocalizedUrl
}: {
	seo: SeoPageData;
	pathname: string;
	locale: SupportedLocale;
	siteName: string;
	siteOrigin: string;
	resolveLocalizedUrl: ResolveLocalizedUrl;
}): SeoConfig {
	return {
		title: seo.title,
		description: seo.description,
		url: resolveUrl(resolveLocalizedUrl, pathname, locale),
		website: normalizeSiteOrigin(siteOrigin),
		language: OG_LOCALES[locale],
		open_graph_image: seo.openGraphImage,
		open_graph_image_alt: seo.openGraphImageAlt,
		site_name: siteName,
		twitter_card_type: 'summary_large_image'
	};
}

export function buildAlternateLinks({
	pathname,
	resolveLocalizedUrl,
	locales = SUPPORTED_LOCALES,
	defaultLocale = 'zh-tw'
}: {
	pathname: string;
	resolveLocalizedUrl: ResolveLocalizedUrl;
	locales?: readonly SupportedLocale[];
	defaultLocale?: SupportedLocale;
}): SeoAlternateLink[] {
	const alternateLinks = locales.map((locale) => ({
		hreflang: HREFLANGS[locale],
		href: resolveUrl(resolveLocalizedUrl, pathname, locale)
	}));

	alternateLinks.push({
		hreflang: 'x-default',
		href: resolveUrl(resolveLocalizedUrl, pathname, defaultLocale)
	});

	return alternateLinks;
}

export function buildStructuredData({
	seo,
	pathname,
	locale,
	siteOrigin,
	resolveLocalizedUrl,
	logoUrl,
	organization,
	sameAs = [],
	breadcrumbItems = [],
	mainEntityOrganization = false
}: {
	seo: SeoPageData;
	pathname: string;
	locale: SupportedLocale;
	siteOrigin: string;
	resolveLocalizedUrl: ResolveLocalizedUrl;
	logoUrl: string;
	organization: SeoOrganizationData;
	sameAs?: string[];
	breadcrumbItems?: SeoBreadcrumbItem[];
	mainEntityOrganization?: boolean;
}): SchemaOrgProps['schema'] {
	const siteUrl = normalizeSiteOrigin(siteOrigin);
	const canonicalUrl = resolveUrl(resolveLocalizedUrl, pathname, locale);
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
			url: logoUrl
		},
		email: organization.email,
		telephone: organization.telephone,
		faxNumber: organization.fax,
		address: {
			'@type': 'PostalAddress',
			streetAddress: organization.address,
			addressCountry: organization.addressCountry ?? 'TW'
		},
		contactPoint: [
			{
				'@type': 'ContactPoint',
				contactType: 'sales',
				telephone: organization.telephone,
				email: organization.email,
				availableLanguage: organization.availableLanguages ?? ['en', 'zh-TW'],
				areaServed: organization.areaServed ?? 'Worldwide'
			}
		]
	};

	if (sameAs.length > 0) {
		organizationSchema['sameAs'] = sameAs;
	}

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
		}
	};

	if (mainEntityOrganization) {
		pageSchema['mainEntity'] = {
			'@id': organizationId
		};
	}

	const schema: JsonLdNode[] = [organizationSchema, websiteSchema, pageSchema];

	if (breadcrumbItems.length > 0) {
		schema.push({
			'@type': 'BreadcrumbList',
			'@id': `${canonicalUrl}#breadcrumb`,
			itemListElement: [
				...breadcrumbItems.map((item, index) => ({
					'@type': 'ListItem',
					position: index + 1,
					name: item.name,
					item: resolveUrl(resolveLocalizedUrl, item.pathname, locale)
				})),
				{
					'@type': 'ListItem',
					position: breadcrumbItems.length + 1,
					name: seo.title,
					item: canonicalUrl
				}
			]
		});
	}

	return schema as SchemaOrgProps['schema'];
}
