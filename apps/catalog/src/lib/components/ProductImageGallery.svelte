<script lang="ts">
	import type { CatalogImageRecord } from '$lib/catalog/types.js';

	type Props = {
		productName: string;
		images: CatalogImageRecord[];
		selectedIndex: number;
		onSelectImage: (index: number) => void;
		galleryLabel: string;
	};

	let { productName, images, selectedIndex, onSelectImage, galleryLabel }: Props = $props();
</script>

<section aria-label={galleryLabel}>
	<div
		class="group relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-bg-sunken text-text-accent shadow-xs transition-[border-color,box-shadow,transform] duration-base ease-ui hover:-translate-y-0.5 hover:border-border-accent hover:shadow-sm"
	>
		{#if images[selectedIndex]}
			<img
				src={images[selectedIndex]?.imageUrl}
				alt={images[selectedIndex]?.altText}
				class="h-full w-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.03]"
			/>
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
					class={`relative aspect-4/3 overflow-hidden rounded-md border bg-bg-sunken transition-[border-color,transform,opacity] duration-base ease-ui hover:-translate-y-0.5 ${selectedIndex === index ? 'border-2 border-brand' : 'border-border opacity-65 hover:border-border-accent hover:opacity-100'}`}
					aria-label={image.altText}
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
