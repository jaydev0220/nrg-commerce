<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { LANDING_ASSETS, assetUrl } from '$lib/assets';
	import * as m from '$lib/paraglide/messages';
	import { extractLocaleFromUrl, localizeHref } from '$lib/paraglide/runtime';
	import type { SupportedLocale } from '@packages/seo';

	const projectBriefItems = [
		() => m.capabilities_brief_product(),
		() => m.capabilities_brief_specification(),
		() => m.capabilities_brief_quantity(),
		() => m.capabilities_brief_destination(),
		() => m.capabilities_brief_application()
	];
	const productPhotos = [
		{
			id: 'beakers',
			src: assetUrl(LANDING_ASSETS.productBeakers),
			caption: () => m.capabilities_photo_beakers()
		},
		{
			id: 'tubes',
			src: assetUrl(LANDING_ASSETS.productTubes),
			caption: () => m.capabilities_photo_tubes()
		},
		{
			id: 'hydrometers',
			src: assetUrl(LANDING_ASSETS.productHydrometers),
			caption: () => m.capabilities_photo_hydrometers()
		}
	];
	const locale = $derived(extractLocaleFromUrl(page.url) as SupportedLocale);
</script>

<PageHeader
	breadcrumb={m.breadcrumb_capabilities()}
	title={m.capabilities_page_title()}
/>

<section class="bg-bg-page py-16 lg:py-20">
	<div class="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
		<p class="max-w-4xl text-lg leading-relaxed text-text-body">{m.capabilities_intro()}</p>

		<div class="grid gap-6 md:grid-cols-2">
			<article class="rounded-xl border border-border bg-bg-surface p-6">
				<h2 class="text-2xl font-bold text-text-heading">
					{m.capabilities_manufacturing_heading()}
				</h2>
				<p class="mt-3 leading-relaxed text-text-body">{m.capabilities_manufacturing()}</p>
			</article>
			<article class="rounded-xl border border-border bg-bg-surface p-6">
				<h2 class="text-2xl font-bold text-text-heading">{m.capabilities_sourcing_heading()}</h2>
				<p class="mt-3 leading-relaxed text-text-body">{m.capabilities_sourcing()}</p>
			</article>
			<article class="rounded-xl border border-border bg-bg-surface p-6">
				<h2 class="text-2xl font-bold text-text-heading">{m.capabilities_custom_heading()}</h2>
				<p class="mt-3 leading-relaxed text-text-body">{m.capabilities_custom()}</p>
			</article>
			<article class="rounded-xl border border-border bg-bg-surface p-6">
				<h2 class="text-2xl font-bold text-text-heading">{m.capabilities_breadth_heading()}</h2>
				<p class="mt-3 leading-relaxed text-text-body">{m.capabilities_breadth()}</p>
			</article>
		</div>

		<section aria-labelledby="specification-boundaries">
			<h2
				id="specification-boundaries"
				class="text-3xl font-bold text-text-heading"
			>
				{m.capabilities_boundaries_heading()}
			</h2>
			<p class="mt-4 max-w-4xl leading-relaxed text-text-body">{m.capabilities_boundaries()}</p>
		</section>

		<section
			aria-labelledby="project-brief"
			class="rounded-xl bg-bg-accent p-6 md:p-8"
		>
			<h2
				id="project-brief"
				class="text-3xl font-bold text-text-heading"
			>
				{m.capabilities_brief_heading()}
			</h2>
			<p class="mt-3 text-text-body">{m.capabilities_brief_intro()}</p>
			<ul class="mt-4 list-disc space-y-2 pl-6 text-text-body">
				{#each projectBriefItems as item, index (index)}
					<li>{item()}</li>
				{/each}
			</ul>
		</section>

		<section aria-labelledby="finished-products">
			<h2
				id="finished-products"
				class="text-3xl font-bold text-text-heading"
			>
				{m.capabilities_photos_heading()}
			</h2>
			<div class="mt-6 grid gap-6 md:grid-cols-3">
				{#each productPhotos as photo (photo.id)}
					<figure class="overflow-hidden rounded-xl border border-border bg-bg-surface">
						<img
							src={photo.src}
							alt=""
							width="1200"
							height="800"
							loading="lazy"
							decoding="async"
							class="aspect-3/2 w-full object-cover"
						/>
						<figcaption class="p-4 text-sm leading-relaxed text-text-body">
							{photo.caption()}
						</figcaption>
					</figure>
				{/each}
			</div>
		</section>

		<section
			class="rounded-xl bg-accent-700 p-8 text-text-on-accent"
			aria-labelledby="capabilities-contact"
		>
			<h2
				id="capabilities-contact"
				class="text-3xl font-bold text-text-on-accent"
			>
				{m.capabilities_cta_heading()}
			</h2>
			<p class="mt-3 max-w-3xl text-accent-200">{m.capabilities_cta_body()}</p>
			<a
				href={resolve(localizeHref('/contact/?type=b2b', { locale }) as Pathname)}
				class="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-6 py-3 font-medium hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:outline-none"
			>
				{m.capabilities_cta()}
			</a>
		</section>
	</div>
</section>
