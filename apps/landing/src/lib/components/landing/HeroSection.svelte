<script lang="ts">
	import { page } from '$app/state';
	import type { SupportedLocale } from '@packages/seo';
	import * as m from '$lib/paraglide/messages';
	import { extractLocaleFromUrl } from '$lib/paraglide/runtime';
	import { getShopUrl, shopCta } from '$lib/data';
	import { splitLineBreakTags } from '$lib/utils/line-breaks';

	let shopHref = $derived(getShopUrl(extractLocaleFromUrl(page.url) as SupportedLocale));
</script>

<section class="flex h-125 min-h-140 items-center bg-bg-accent md:h-114 xl:h-140">
	<div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="items-center gap-8 xl:gap-16">
			<div class="order-2 space-y-6 xl:order-1 xl:space-y-8 xl:pr-8">
				<!-- Main Heading -->
				<div class="space-y-3">
					<h1 class="text-4xl leading-tight font-bold text-text-heading">
						{#each splitLineBreakTags(m.company_tagline()) as segment, index (index)}
							{#if segment.type === 'text'}
								{segment.value}
							{:else}
								<br />
							{/if}
						{/each}
					</h1>
					<p class="text-lg leading-relaxed text-text-muted">
						{m.hero_tagline_secondary()}
					</p>
				</div>

				<!-- CTA Button -->
				<div class="space-y-2">
					<a
						href={shopHref}
						target="_blank"
						rel="external noopener noreferrer"
						class="
							inline-flex h-12 w-full items-center justify-center rounded-md bg-brand px-6 py-3
							font-medium text-text-on-accent transition-colors duration-200
							hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand
							focus-visible:ring-offset-2 focus-visible:outline-none md:h-12 md:w-45 xl:h-13 xl:w-50
						"
					>
						{shopCta.label()}
					</a>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	section {
		--ease-ui: cubic-bezier(0.4, 0, 0.2, 1);
		--duration-base: 180ms;
	}
</style>
