<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		PUBLIC_CDN_BASE_URL,
		PUBLIC_COOKIE_DOMAIN,
		PUBLIC_FACEBOOK_URL,
		PUBLIC_HOME_URL,
		PUBLIC_LINE_URL
	} from '$env/static/public';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import * as m from '$lib/paraglide/messages';
	import {
		deLocalizeUrl,
		extractLocaleFromUrl,
		localizeHref,
		setLocale,
		type Locale
	} from '$lib/paraglide/runtime';
	import { Footer, Navbar, type CtaConfig, type NavLinkItem } from '@packages/components';
	import {
		buildAlternateLinks,
		buildSeoConfig,
		buildStructuredData,
		createSeoPageData,
		type SeoOrganizationData,
		type SupportedLocale
	} from '@packages/seo';
	import { onMount } from 'svelte';
	import { Head, SchemaOrg, type SchemaOrgProps } from 'svead';
	import './layout.css';

	const THEME_COOKIE_NAME = 'theme';
	const cdnBaseUrl = PUBLIC_CDN_BASE_URL.trim();
	const THEME_COOKIE_DOMAIN = PUBLIC_COOKIE_DOMAIN.trim();
	const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
	const facebookUrl = PUBLIC_FACEBOOK_URL.trim();
	const homeUrl = PUBLIC_HOME_URL.trim();
	const lineUrl = PUBLIC_LINE_URL.trim();

	let { children } = $props();
	let locale = $derived((extractLocaleFromUrl(page.url) ?? 'zh-tw') as Locale);
	let seoLocale = $derived(locale as SupportedLocale);
	let skipTarget = $derived(
		page.url.pathname.includes('/products/') ? 'product-content' : 'catalog-content'
	);
	let theme = $state<'light' | 'dark'>('light');

	const currentYear = new Date().getFullYear();
	const fallbackSeo = createSeoPageData({
		title: m.catalog_meta_title(),
		description: m.catalog_meta_description(),
		pageType: 'CollectionPage',
		openGraphImage: catalogCdnUrl('/og/catalog/gallery.webp'),
		openGraphImageAlt: m.catalog_title()
	}).seo;
	const ctaConfig: CtaConfig = $derived({
		href: resolve(localizeHref('/inquiry', { locale }) as Pathname),
		label: m.catalog_inquiry_cta()
	});
	const canonicalPathname = $derived(deLocalizeUrl(page.url).pathname);
	const seoPage = $derived(page.data.seo ?? fallbackSeo);
	const organization: SeoOrganizationData = $derived({
		name: m.company_name(),
		description: m.company_description(),
		address: m.contact_address_value(),
		telephone: m.contact_phone_value(),
		fax: m.contact_fax_value(),
		email: m.contact_email_value()
	});
	const seoConfig = $derived(
		buildSeoConfig({
			seo: seoPage,
			pathname: page.url.pathname,
			locale: seoLocale,
			siteName: organization.name,
			siteOrigin: page.url.origin,
			resolveLocalizedUrl: resolveCatalogSeoUrl
		})
	);
	const alternateLinks = $derived(
		buildAlternateLinks({
			pathname: page.url.pathname,
			resolveLocalizedUrl: resolveCatalogSeoUrl
		})
	);
	const baseStructuredData = $derived(
		buildStructuredData({
			seo: seoPage,
			pathname: page.url.pathname,
			locale: seoLocale,
			siteOrigin: page.url.origin,
			resolveLocalizedUrl: resolveCatalogSeoUrl,
			logoUrl: catalogCdnUrl('/logo-light.svg'),
			organization,
			sameAs: [facebookUrl, lineUrl].filter(Boolean),
			breadcrumbItems:
				canonicalPathname === '/'
					? []
					: [
							{
								name: m.catalog_title(),
								pathname: '/'
							}
						]
		})
	);
	const productStructuredData = $derived(
		page.data['productStructuredData'] as SchemaOrgProps['schema'] | undefined
	);
	const robotsContent = $derived(page.url.search ? 'noindex,follow' : 'index,follow');

	function catalogCdnUrl(path: string): string {
		if (!cdnBaseUrl) {
			return path;
		}

		return new URL(path, cdnBaseUrl).toString();
	}

	function getLocalizedLandingHref(nextLocale: Locale): string {
		if (!homeUrl) {
			return resolve(localizeHref('/', { locale: nextLocale }) as Pathname);
		}

		try {
			return new URL(nextLocale === 'en' ? '/en' : '/', homeUrl).toString();
		} catch {
			return resolve(localizeHref('/', { locale: nextLocale }) as Pathname);
		}
	}

	const navigationLinks = $derived.by<NavLinkItem[]>(() => [
		{
			href: getLocalizedLandingHref(locale),
			id: 'home',
			label: m.nav_home()
		},
		{
			href: resolve(localizeHref('/', { locale }) as Pathname),
			id: 'products',
			label: m.catalog_title()
		}
	]);

	function resolveCatalogSeoUrl(pathname: string, nextLocale: SupportedLocale): URL {
		const canonicalPathname = deLocalizeUrl(new URL(pathname, page.url.origin)).pathname;
		return new URL(
			localizeHref(canonicalPathname, { locale: nextLocale }) as string,
			page.url.origin
		);
	}

	function getThemeFromCookie(): 'light' | 'dark' | null {
		const storedTheme = document.cookie
			.split('; ')
			.find((cookie) => cookie.startsWith(`${THEME_COOKIE_NAME}=`))
			?.split('=')[1];

		if (storedTheme === 'light' || storedTheme === 'dark') {
			return storedTheme;
		}

		return null;
	}

	function persistTheme(nextTheme: 'light' | 'dark') {
		const cookieParts = [
			`${THEME_COOKIE_NAME}=${nextTheme}`,
			'Path=/',
			`Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}`,
			'SameSite=Lax'
		];

		if (THEME_COOKIE_DOMAIN) {
			cookieParts.push(`Domain=${THEME_COOKIE_DOMAIN}`);
		}

		if (window.location.protocol === 'https:') {
			cookieParts.push('Secure');
		}

		document.cookie = cookieParts.join('; ');
	}

	function applyTheme(nextTheme: 'light' | 'dark') {
		theme = nextTheme;
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(nextTheme);
		document.documentElement.style.colorScheme = nextTheme;
		persistTheme(nextTheme);
	}

	function selectLocale(nextLocale: string) {
		if (nextLocale !== 'zh-tw' && nextLocale !== 'en') {
			return;
		}

		void setLocale(nextLocale as Locale);
	}

	function toggleTheme() {
		applyTheme(theme === 'light' ? 'dark' : 'light');
	}

	function toggleFooterLocale() {
		void selectLocale(locale === 'zh-tw' ? 'en' : 'zh-tw');
	}

	onMount(() => {
		const root = document.documentElement;
		theme = getThemeFromCookie() ?? (root.classList.contains('dark') ? 'dark' : 'light');
		applyTheme(theme);
	});
</script>

<Head seo_config={seoConfig} />
<SchemaOrg schema={baseStructuredData} />
{#if productStructuredData}
	<SchemaOrg schema={productStructuredData} />
{/if}

<svelte:head>
	<meta
		name="robots"
		content={robotsContent}
	/>
	{#each alternateLinks as alternate (alternate.hreflang)}
		<link
			rel="alternate"
			hreflang={alternate.hreflang}
			href={alternate.href}
		/>
	{/each}
</svelte:head>

<div class="flex min-h-screen flex-col">
	<a
		href={`#${skipTarget}`}
		class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-text-on-accent"
	>
		{page.url.pathname.includes('/products/')
			? m.catalog_skip_to_product()
			: m.catalog_skip_to_catalog()}
	</a>

	<Navbar
		cta={ctaConfig}
		navLinks={navigationLinks}
		onSelectLanguage={selectLocale}
		onToggleTheme={toggleTheme}
	/>

	<div class="flex-1">
		{@render children()}
	</div>

	<Footer
		description={m.company_description()}
		copyrightText={`© ${currentYear} ${m.company_name()} ${m.footer_copyright()}`}
		onToggleLanguage={toggleFooterLocale}
	/>
</div>
