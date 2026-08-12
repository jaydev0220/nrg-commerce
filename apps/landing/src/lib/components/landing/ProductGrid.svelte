<script lang="ts">
	import { page } from '$app/state';
	import { productCategories } from '$lib/data';
	import * as m from '$lib/paraglide/messages';
	import { extractLocaleFromUrl } from '$lib/paraglide/runtime';
	import type { SupportedLocale } from '@packages/seo';

	const locale = $derived(extractLocaleFromUrl(page.url) as SupportedLocale);
</script>

<section class="bg-bg-page py-16 lg:py-20">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mb-8 lg:mb-16">
			<h2 class="mb-2 text-3xl font-bold text-text-heading lg:text-4xl">
				{m.product_series_heading()}
			</h2>
		</div>

		<div class="product-grid grid gap-4">
			{#each productCategories as category (category.id)}
				<a
					href={category.href(locale)}
					target="_blank"
					rel="external noopener noreferrer"
					class="product-card relative flex min-h-36 items-end overflow-hidden rounded-xl bg-border transition-colors duration-200 hover:bg-border-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
					style:--grid-area={category.gridArea}
				>
					<img
						src={category.image}
						alt={category.alt()}
						width={category.width}
						height={category.height}
						class="absolute inset-0 h-full w-full object-cover"
						loading="lazy"
						decoding="async"
					/>
					<div
						class="relative z-10 w-full bg-linear-to-t from-neutral-900/70 to-transparent p-4 md:p-6"
					>
						<h3 class="text-sm font-bold text-white">{category.name()}</h3>
					</div>
				</a>
			{/each}
		</div>
	</div>
</section>

<style>
	.product-card {
		grid-area: var(--grid-area);
	}

	@media (min-width: 48rem) {
		.product-grid {
			grid-template-areas:
				'beakers tubes'
				'funnels condensers'
				'hydrometers hydrometers';
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.product-card {
			min-height: 11.25rem;
		}
	}

	@media (min-width: 64rem) {
		.product-grid {
			grid-template-areas:
				'beakers tubes condensers'
				'beakers funnels hydrometers';
			grid-template-columns: repeat(3, minmax(0, 1fr));
			grid-template-rows: repeat(2, minmax(0, 1fr));
			min-height: 23.25rem;
		}
	}
</style>
