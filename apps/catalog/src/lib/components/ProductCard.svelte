<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import * as m from '$lib/paraglide/messages';
	import type { CatalogProductView } from '$lib/catalog/types.js';

	type Props = {
		view: CatalogProductView;
		categoryLabel: string | null;
		href: string;
	};

	let { view, categoryLabel, href }: Props = $props();

	function imagePosition(): string {
		const image = view.representativeImage;
		return `${(image?.focusX ?? 0.5) * 100}% ${(image?.focusY ?? 0.5) * 100}%`;
	}

	function imageStyle(): string {
		const image = view.representativeImage;
		const focusX = image?.focusX ?? 0.5;
		const focusY = image?.focusY ?? 0.5;
		const zoom = image?.zoom ?? 1;
		return `object-position: ${imagePosition()}; transform: scale(${zoom}); transform-origin: ${focusX * 100}% ${focusY * 100}%;`;
	}
</script>

<article
	class="group duration-base overflow-hidden rounded-lg border border-border bg-bg-surface shadow-xs transition-[transform,border-color,box-shadow] ease-ui hover:-translate-y-0.5 hover:border-border-accent hover:shadow-sm"
>
	<a
		href={resolve(href as Pathname)}
		class="relative block aspect-square overflow-hidden bg-bg-sunken text-text-accent focus:ring-2 focus:ring-brand focus:outline-none focus:ring-inset"
	>
		{#if view.representativeImage}
			<img
				src={view.representativeImage.imageUrl}
				alt={view.representativeImage.altText}
				loading="lazy"
				class="h-full w-full object-cover"
				style={imageStyle()}
			/>
		{:else}
			<span
				class="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,var(--color-bg-surface),transparent_68%)] opacity-90"
			></span>
			<span class="absolute inset-0 grid place-items-center p-6 text-center">
				<span
					class="rounded-md border border-border bg-bg-surface/90 px-3 py-2 text-sm font-semibold text-text-heading"
				>
					{view.name}
				</span>
			</span>
		{/if}
		<span
			class="duration-base absolute right-3 bottom-3 translate-y-2 rounded-md border border-border bg-bg-surface/90 px-2.5 py-1.5 text-[11px] font-semibold text-text-heading opacity-0 shadow-xs backdrop-blur transition-all group-hover:translate-y-0 group-hover:opacity-100"
		>
			{m.catalog_view_product()}
		</span>
	</a>
	<div class="flex min-h-12 flex-col p-5">
		<div class="mb-1 flex items-start justify-between gap-3">
			{#if categoryLabel}
				<p class="text-xs font-medium text-text-accent">{categoryLabel}</p>
			{:else}
				<span></span>
			{/if}
			<span
				class="rounded-sm bg-brand-subtle px-2 py-1 font-mono text-[10px] whitespace-nowrap text-text-accent"
			>
				{view.skuCount}
				{view.skuCount === 1 ? m.catalog_configuration() : m.catalog_configurations()}
			</span>
		</div>
		<h2 class="text-xl leading-snug tracking-normal">
			<a
				href={resolve(href as Pathname)}
				class="duration-base transition-colors ease-ui hover:text-text-accent"
			>
				{view.name}
			</a>
		</h2>
		{#if view.description}
			<p class="mt-2 line-clamp-2 text-sm text-text-muted">{view.description}</p>
		{/if}
		<div class="flex justify-end pt-3">
			<a
				href={resolve(href as Pathname)}
				class="duration-base inline-flex items-center gap-2 rounded-md border border-border-strong bg-bg-surface px-3 py-2 text-xs font-semibold text-text-heading transition-[color,background-color,border-color,transform] ease-ui hover:-translate-y-0.5 hover:border-border-accent hover:bg-brand-subtle hover:text-text-accent"
			>
				{m.catalog_view_product()}
				<ArrowRight class="size-3.5" />
			</a>
		</div>
	</div>
</article>
