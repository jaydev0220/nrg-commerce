<script lang="ts">
	import { Maximize2 } from '@lucide/svelte';

	import type { CatalogImageRecord } from '$lib/catalog/types.js';
	import ProductImageLightbox from './ProductImageLightbox.svelte';

	type Props = {
		productName: string;
		images: CatalogImageRecord[];
		selectedIndex: number;
		onSelectImage: (index: number) => void;
		galleryLabel: string;
		openLabel: string;
		closeLabel: string;
		previousLabel: string;
		nextLabel: string;
	};

	let {
		productName,
		images,
		selectedIndex,
		onSelectImage,
		galleryLabel,
		openLabel,
		closeLabel,
		previousLabel,
		nextLabel
	}: Props = $props();

	let lightboxOpen = $state(false);
	let currentIndex = $derived(Math.min(selectedIndex, Math.max(images.length - 1, 0)));

	function openLightbox() {
		if (images.length > 0) lightboxOpen = true;
	}
</script>

<section aria-label={galleryLabel}>
	<div
		class="group duration-base relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-bg-sunken text-text-accent shadow-xs transition-[border-color,box-shadow,transform] ease-ui hover:-translate-y-0.5 hover:border-border-accent hover:shadow-sm"
	>
		{#if images[currentIndex]}
			<button
				type="button"
				class="relative block h-full w-full cursor-zoom-in text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset"
				aria-label={openLabel}
				onclick={openLightbox}
			>
				<img
					src={images[currentIndex]?.imageUrl}
					alt={images[currentIndex]?.altText}
					class="h-full w-full object-contain"
				/>
				<span
					class="pointer-events-none absolute top-3 right-3 inline-grid size-9 place-items-center rounded-md border border-border bg-bg-surface/90 text-text-heading shadow-sm"
					aria-hidden="true"
				>
					<Maximize2 class="size-4" />
				</span>
			</button>
		{:else}
			<span
				class="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,var(--color-bg-surface),transparent_68%)]"
			></span>
			<span class="absolute inset-0 grid place-items-center p-6 text-center">
				<span
					class="rounded-md border border-border bg-bg-surface/90 px-3 py-2 text-sm font-semibold text-text-heading"
				>
					{productName}
				</span>
			</span>
		{/if}
	</div>

	{#if images.length > 1}
		<div
			class="mt-3 grid grid-cols-3 gap-3"
			aria-label={galleryLabel}
		>
			{#each images as image, index (image.id)}
				<button
					type="button"
					class={`duration-base relative aspect-4/3 overflow-hidden rounded-md border bg-bg-sunken transition-[border-color,transform,opacity] ease-ui hover:-translate-y-0.5 ${currentIndex === index ? 'border-2 border-brand' : 'border-border opacity-65 hover:border-border-accent hover:opacity-100'}`}
					aria-label={image.altText}
					aria-current={currentIndex === index ? 'true' : undefined}
					onclick={() => onSelectImage(index)}
				>
					<img
						src={image.imageUrl}
						alt=""
						class="h-full w-full object-cover"
					/>
				</button>
			{/each}
		</div>
	{/if}
</section>

<ProductImageLightbox
	open={lightboxOpen}
	{productName}
	{images}
	selectedIndex={currentIndex}
	{galleryLabel}
	{closeLabel}
	{previousLabel}
	{nextLabel}
	onclose={() => (lightboxOpen = false)}
	onselect={onSelectImage}
/>
