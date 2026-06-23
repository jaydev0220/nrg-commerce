<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import * as m from '$lib/paraglide/messages';
	import {
		extractLocaleFromUrl,
		localizeHref,
		setLocale,
		type Locale
	} from '$lib/paraglide/runtime';
	import { Footer, Navbar, type CtaConfig, type NavLinkItem } from '@packages/components';
	import { onMount } from 'svelte';
	import './layout.css';

	const THEME_COOKIE_NAME = 'theme';
	const THEME_COOKIE_DOMAIN = import.meta.env['PUBLIC_COOKIE_DOMAIN']?.trim() ?? '';
	const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
	const ctaUrl = import.meta.env['PUBLIC_CTA_URL']?.trim() ?? '';

	let { children } = $props();
	let locale = $derived((extractLocaleFromUrl(page.url) ?? 'zh-tw') as Locale);
	let skipTarget = $derived(
		page.url.pathname.includes('/products/') ? 'product-content' : 'catalog-content'
	);
	let theme = $state<'light' | 'dark'>('light');

	const currentYear = new Date().getFullYear();
	const ctaConfig: CtaConfig = {
		href: ctaUrl,
		label: 'CTA Text'
	};
	const navigationLinks = $derived.by<NavLinkItem[]>(() => [
		{
			href: resolve(localizeHref('/', { locale }) as Pathname),
			id: 'products',
			label: m.catalog_title()
		}
	]);

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
