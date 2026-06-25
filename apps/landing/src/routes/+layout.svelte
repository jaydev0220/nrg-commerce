<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { Footer, Navbar, type CtaConfig, type NavLinkItem } from '@packages/components';
	import * as m from '$lib/paraglide/messages';
	import { getShopUrl, navLinks } from '$lib/data';
	import {
		extractLocaleFromUrl,
		localizeHref,
		setLocale,
		type Locale
	} from '$lib/paraglide/runtime';
	import {
		buildAlternateLinks,
		buildSeoConfig,
		buildStructuredData,
		getDefaultSeoPageData,
		type SeoPageData,
		type SeoOrganizationData,
		type SupportedLocale
	} from '$lib/seo';
	import { theme } from '$lib/state/theme.svelte';
	import { CDN_ASSETS, cdnUrl } from '$lib/utils/cdn';
	import { Head, SchemaOrg } from 'svead';
	import './layout.css';

	let { children } = $props();

	const currentYear = new Date().getFullYear();

	const fallbackSeo: SeoPageData = getDefaultSeoPageData(
		m.home_meta_title(),
		m.home_meta_description(),
		m.home_meta_title()
	);
	const locale = $derived(extractLocaleFromUrl(page.url) as SupportedLocale);
	const ctaConfig: CtaConfig = $derived({
		href: getShopUrl(locale),
		label: m.cta_visit_shop()
	});

	const seoPage = $derived(page.data.seo ?? fallbackSeo);
	const organization: SeoOrganizationData = $derived({
		name: m.company_name(),
		description: m.company_description(),
		address: m.contact_address_value(),
		telephone: m.contact_phone_value(),
		fax: m.contact_fax_value(),
		email: m.contact_email_value()
	});
	const seoConfig = $derived(buildSeoConfig(seoPage, page.url.pathname, locale, organization.name));
	const structuredData = $derived(
		buildStructuredData(seoPage, page.url.pathname, locale, organization, m.nav_home())
	);
	const alternateLinks = $derived(buildAlternateLinks(page.url.pathname));
	const navigationLinks = $derived.by<NavLinkItem[]>(() =>
		navLinks.map((link) => {
			return {
				href: resolve(localizeHref(link.href, { locale }) as Pathname),
				id: link.id,
				label: link.label()
			};
		})
	);

	function toggleTheme() {
		theme.toggle();
	}

	function selectLocale(nextLocale: string) {
		if (nextLocale !== 'zh-tw' && nextLocale !== 'en') {
			return;
		}

		void setLocale(nextLocale as Locale);
	}

	function toggleFooterLocale() {
		void selectLocale(locale === 'zh-tw' ? 'en' : 'zh-tw');
	}
</script>

<Head seo_config={seoConfig} />
<SchemaOrg schema={structuredData} />

<svelte:head>
	<link
		rel="icon"
		href={cdnUrl(CDN_ASSETS.favicon)}
		type="image/x-icon"
	/>
	<link
		rel="apple-touch-icon"
		href={cdnUrl(CDN_ASSETS.favicon)}
	/>
	<meta
		name="theme-color"
		media="(prefers-color-scheme: light)"
		content="#f8f7f5"
	/>
	<meta
		name="theme-color"
		media="(prefers-color-scheme: dark)"
		content="#131110"
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
		href="#main-content"
		class="
			sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-bg-surface
			focus:px-3 focus:py-2 focus:text-sm focus:text-text-body focus:shadow-md
		"
	>
		{m.a11y_skip_to_main()}
	</a>
	<Navbar
		cta={ctaConfig}
		navLinks={navigationLinks}
		onSelectLanguage={selectLocale}
		onToggleTheme={toggleTheme}
	/>
	<main
		id="main-content"
		tabindex="-1"
		class="flex-1"
	>
		{@render children()}
	</main>
	<Footer
		description={m.company_description()}
		copyrightText={`© ${currentYear} ${m.company_name()} ${m.footer_copyright()}`}
		onToggleLanguage={toggleFooterLocale}
	/>
</div>
