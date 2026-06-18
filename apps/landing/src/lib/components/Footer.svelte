<script lang="ts">
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import Logo from '$lib/components/Logo.svelte';
	import { socialLinks } from '$lib/data';
	import SocialIcon from '$lib/components/SocialIcon.svelte';

	const currentYear = new Date().getFullYear();

	function toggleLanguage() {
		const newLang = getLocale() === 'zh-tw' ? 'en' : 'zh-tw';
		setLocale(newLang);
	}
</script>

<footer class="bg-accent-700 text-text-on-accent">
	<!-- Desktop/Tablet Layout -->
	<div class="hidden md:block">
		<div class="mx-auto h-60 max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex items-start justify-between pt-12">
				<!-- Left: Logo + Description -->
				<div class="flex flex-col space-y-3">
					<div class="flex items-center">
						<Logo class="h-10 w-auto" width={108} height={40} />
					</div>
					<p class="max-w-xs text-sm text-accent-200">
						{m.company_description()}
					</p>
				</div>

				<!-- Right: Social Links -->
				<div class="flex items-center space-x-3">
					{#each socialLinks as social (social.id)}
						<a
							href={social.href}
							target="_blank"
							rel="external noopener noreferrer"
							class="
								inline-flex h-8 min-w-22 items-center justify-center gap-1 rounded bg-accent-600 px-3 py-1.5
								text-xs font-medium text-text-on-accent transition-colors duration-200 hover:-translate-y-0.5 hover:bg-accent-500
								focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
							"
							aria-label={social.label()}
						>
							<SocialIcon icon={social.icon} classList="h-4 w-auto" />
							{social.label()}
						</a>
					{/each}
				</div>
			</div>

			<!-- Divider -->
			<div class="mt-12 border-t border-accent-600"></div>

			<!-- Bottom Row -->
			<div class="flex items-center justify-between pt-6">
				<p class="text-sm text-accent-200">
					© {currentYear}
					{m.company_name()}. {getLocale() === 'zh-tw' ? '版權所有。' : 'All rights reserved.'}
				</p>
				<button
					onclick={toggleLanguage}
					class="
						text-sm text-accent-200 transition-colors duration-200 hover:-translate-y-0.5 hover:text-text-on-accent
						focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
					"
				>
					{m.footer_language_toggle()}
				</button>
			</div>
		</div>
	</div>

	<!-- Mobile Layout -->
	<div class="md:hidden">
		<div class="mx-auto max-w-7xl space-y-6 px-4 py-8">
			<!-- Logo + Description -->
			<div class="space-y-3">
				<div class="flex items-center">
					<Logo class="h-10 w-auto" width={108} height={40} />
				</div>
				<p class="text-sm text-accent-200">
					{m.company_description()}
				</p>
			</div>

			<!-- Social Links -->
			<div class="flex items-center space-x-3">
				{#each socialLinks as social (social.id)}
					<a
						href={social.href}
						target="_blank"
						rel="external noopener noreferrer"
						class="
							inline-flex h-8 min-w-22 items-center justify-center gap-1 rounded bg-accent-600 px-3 py-1.5
							text-xs font-medium text-text-on-accent transition-colors duration-200 hover:-translate-y-0.5 hover:bg-accent-500
							focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
						"
						aria-label={social.label()}
					>
						<SocialIcon icon={social.icon} classList="h-4 w-auto" />
						{social.label()}
					</a>
				{/each}
			</div>

			<!-- Divider -->
			<div class="border-t border-accent-600"></div>

			<!-- Bottom Row -->
			<div class="space-y-2">
				<p class="text-sm text-accent-200">
					© {currentYear}
					{m.company_name()}
					{m.footer_copyright()}
				</p>
				<button
					onclick={toggleLanguage}
					class="
						text-sm text-accent-200 transition-colors duration-200 hover:-translate-y-0.5 hover:text-text-on-accent
						focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
					"
				>
					{m.footer_language_toggle()}
				</button>
			</div>
		</div>
	</div>
</footer>

<style>
	footer {
		--ease-ui: cubic-bezier(0.4, 0, 0.2, 1);
		--duration-base: 180ms;
	}
</style>
