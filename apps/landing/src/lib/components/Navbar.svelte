<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Menu } from '@lucide/svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { navLinks, shopCta } from '$lib/data';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import ThemeSwitcher from './ThemeSwitcher.svelte';

	let mobileMenuOpen = $state(false);

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	// Check if current path matches nav item
	function isActive(path: string): boolean {
		if (path === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(path);
	}
</script>

<nav class="sticky top-0 z-40 h-18 w-full border-b border-border bg-bg-page/95 backdrop-blur-sm">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-18 items-center justify-between">
			<!-- Logo -->
			<div class="shrink-0">
				<a href={resolve('/', {})} class="flex items-center" onclick={closeMobileMenu}>
					<Logo class="h-10 w-auto" width={108} height={40} />
				</a>
			</div>

			<!-- Desktop Navigation -->
			<div class="hidden items-center space-x-8 lg:flex">
				{#each navLinks as link (link.id)}
					<a
						href={resolve(link.href, {})}
						class="
							text-sm font-medium transition-colors duration-200 hover:-translate-y-0.5
							focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
							{isActive(link.href) ? 'text-brand' : 'text-text-body hover:text-brand'}
						"
					>
						{link.label()}
					</a>
				{/each}
			</div>

			<!-- Desktop Right Side -->
			<div class="hidden items-center space-x-4 lg:flex">
				<ThemeSwitcher />
				<LanguageSwitcher />
				<a
					href={shopCta.href}
					target="_blank"
					rel="external noopener noreferrer"
					class="
						inline-flex h-10 w-37 items-center justify-center rounded-md bg-brand px-4 py-2
						text-sm font-medium text-text-on-accent transition-colors duration-200 hover:-translate-y-0.5 hover:bg-brand-hover
						focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					"
				>
					{shopCta.label()}
				</a>
			</div>

			<!-- Mobile Right Side -->
			<div class="flex items-center space-x-3 lg:hidden">
				<ThemeSwitcher />
				<LanguageSwitcher />
				<button
					onclick={toggleMobileMenu}
					class="
						rounded-md p-2 text-text-body transition-colors duration-200 hover:bg-bg-accent hover:text-brand focus-visible:ring-2
						focus-visible:ring-brand focus-visible:outline-none
					"
					aria-expanded={mobileMenuOpen}
					aria-label="Toggle mobile menu"
				>
					<Menu class="h-6 w-6" aria-hidden="true" />
				</button>
			</div>
		</div>
	</div>

	<!-- Mobile Menu -->
	{#if mobileMenuOpen}
		<div class="border-t border-border lg:hidden">
			<div class="bg-bg-surface px-4 py-2">
				<div class="space-y-1">
					{#each navLinks as link (link.id)}
						<a
							href={resolve(link.href, {})}
							onclick={closeMobileMenu}
							class="
								block rounded-md px-3 py-2 text-base font-medium transition-colors duration-200
								focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
								{isActive(link.href)
								? 'bg-bg-accent text-brand'
								: 'text-text-body hover:bg-bg-accent hover:text-brand'}
							"
						>
							{link.label()}
						</a>
					{/each}
				</div>

				<!-- Mobile CTA Button -->
				<div class="mt-4 mb-2 border-t border-border pt-4">
					<a
						href={shopCta.href}
						target="_blank"
						rel="external noopener noreferrer"
						onclick={closeMobileMenu}
						class="
							block w-full rounded-md bg-brand px-4 py-3 text-center text-sm font-medium text-text-on-accent
							transition-colors duration-200 hover:-translate-y-0.5 hover:bg-brand-hover
							focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
						"
					>
						{shopCta.label()}
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
