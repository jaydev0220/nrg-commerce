<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { PUBLIC_CDN_BASE_URL } from '$env/static/public';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Menu } from '@lucide/svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import Logo from './Logo.svelte';
	import ThemeSwitcher from './ThemeSwitcher.svelte';
	import type { CtaConfig, LanguageOption, NavLinkItem, ThemeMode } from './types';

	type Props = {
		cta: CtaConfig;
		navLinks: NavLinkItem[];
		onSelectLanguage: (locale: string) => void;
		onToggleTheme: () => void;
	};

	let { cta, navLinks, onSelectLanguage, onToggleTheme }: Props = $props();

	const mobileMenuLabel = 'Toggle mobile menu';
	const cdnBaseUrl = PUBLIC_CDN_BASE_URL.trim();
	const brandLogoLight = $derived(`${cdnBaseUrl}/logo-light.svg`);
	const brandLogoDark = $derived(`${cdnBaseUrl}/logo-dark.svg`);
	const languageOptions: LanguageOption[] = [
		{ label: '繁體中文', shortLabel: '繁中', value: 'zh-tw' },
		{ label: 'English', shortLabel: 'EN', value: 'en' }
	];

	let mobileMenuOpen = $state(false);
	let theme = $state<ThemeMode>('light');
	let currentLocale = $derived(page.url.pathname.startsWith('/en') ? 'en' : 'zh-tw');
	let currentPath = $derived(page.url.pathname);

	function syncTheme() {
		if (!browser) {
			return;
		}

		theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	function handleThemeToggle() {
		onToggleTheme();
		queueMicrotask(syncTheme);
	}

	function handleLanguageSelect(locale: string) {
		onSelectLanguage(locale);
		closeMobileMenu();
	}

	function isActive(path: string): boolean {
		if (path === '/') {
			return currentPath === '/';
		}

		if (currentPath === path) {
			return true;
		}

		return currentPath.startsWith(`${path}/`);
	}

	onMount(() => {
		syncTheme();
	});
</script>

<nav class="sticky top-0 z-40 h-18 w-full border-b border-border bg-bg-page/95 backdrop-blur-sm">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-18 items-center justify-between">
			<div class="shrink-0">
				<a
					href={resolve('/')}
					class="flex items-center"
					aria-label="NRG Labware"
					onclick={closeMobileMenu}
				>
					<Logo
						alt="NRG Labware"
						class="h-10 w-auto"
						darkSrc={brandLogoDark}
						lightSrc={brandLogoLight}
						height={40}
						width={120}
					/>
				</a>
			</div>

			<div class="hidden items-center space-x-8 lg:flex">
				{#each navLinks as link (link.id)}
					<a
						href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
						class={`
							text-sm font-medium transition-colors duration-200 hover:-translate-y-0.5
							focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
							${isActive(link.href) ? 'text-brand' : 'text-text-body hover:text-brand'}
						`}
					>
						{link.label}
					</a>
				{/each}
			</div>

			<div class="hidden items-center space-x-4 lg:flex">
				<ThemeSwitcher
					ariaLabel="Toggle theme"
					darkTitle="Dark theme"
					lightTitle="Light theme"
					onToggle={handleThemeToggle}
					{theme}
				/>
				<LanguageSwitcher
					ariaLabel="Switch language"
					{currentLocale}
					onSelect={handleLanguageSelect}
					options={languageOptions}
				/>
				<a
					href={cta.href}
					target="_blank"
					rel="external noopener noreferrer"
					class="
						inline-flex h-10 w-37 items-center justify-center rounded-md bg-brand px-4 py-2
						text-sm font-medium text-text-on-accent transition-colors duration-200 hover:-translate-y-0.5 hover:bg-brand-hover
						focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					"
				>
					{cta.label}
				</a>
			</div>

			<div class="flex items-center space-x-3 lg:hidden">
				<ThemeSwitcher
					ariaLabel="Toggle theme"
					darkTitle="Dark theme"
					lightTitle="Light theme"
					onToggle={handleThemeToggle}
					{theme}
				/>
				<button
					onclick={toggleMobileMenu}
					class="
						rounded-md p-2 text-text-body transition-colors duration-200 hover:bg-bg-accent hover:text-brand focus-visible:ring-2
						focus-visible:ring-brand focus-visible:outline-none
					"
					aria-expanded={mobileMenuOpen}
					aria-label={mobileMenuLabel}
				>
					<Menu
						class="h-6 w-6"
						aria-hidden="true"
					/>
				</button>
			</div>
		</div>
	</div>

	{#if mobileMenuOpen}
		<div class="border-t border-border lg:hidden">
			<div class="bg-bg-surface px-4 py-2">
				<div class="space-y-1">
					{#each navLinks as link (link.id)}
						<a
							href={link.href}
							aria-current={isActive(link.href) ? 'page' : undefined}
							onclick={closeMobileMenu}
							class={`
								block rounded-md px-3 py-2 text-base font-medium transition-colors duration-200
								focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
								${isActive(link.href) ? 'bg-bg-accent text-brand' : 'text-text-body hover:bg-bg-accent hover:text-brand'}
							`}
						>
							{link.label}
						</a>
					{/each}
				</div>

				<div class="mt-4 mb-2 border-t border-border pt-4">
					<div class="mb-3">
						<LanguageSwitcher
							ariaLabel="Switch language"
							{currentLocale}
							onSelect={handleLanguageSelect}
							options={languageOptions}
						/>
					</div>
					<a
						href={cta.href}
						target="_blank"
						rel="external noopener noreferrer"
						onclick={closeMobileMenu}
						class="
							block w-full rounded-md bg-brand px-4 py-3 text-center text-sm font-medium text-text-on-accent
							transition-colors duration-200 hover:-translate-y-0.5 hover:bg-brand-hover
							focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
						"
					>
						{cta.label}
					</a>
				</div>
			</div>
		</div>
	{/if}
</nav>

<style>
	nav {
		--ease-ui: cubic-bezier(0.4, 0, 0.2, 1);
		--duration-base: 180ms;
	}
</style>
