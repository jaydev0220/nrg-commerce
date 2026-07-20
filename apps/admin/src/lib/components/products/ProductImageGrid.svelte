<script lang="ts">
	import { Pencil, RotateCcw, Trash2, X } from '@lucide/svelte';
	import type { ManagedProductImage } from '$lib/api/admin-api';
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import ProductImageFocusPicker from './ProductImageFocusPicker.svelte';

	let {
		images,
		deletedImages,
		onupdateCrop,
		ondelete,
		onrestore,
		onforceDelete
	}: {
		images: ManagedProductImage[];
		deletedImages: ManagedProductImage[];
		onupdateCrop: (
			imageId: string,
			input: { focusX: number; focusY: number; zoom: number }
		) => Promise<void> | void;
		ondelete: (imageId: string) => Promise<void> | void;
		onrestore: (imageId: string) => Promise<void> | void;
		onforceDelete: (imageId: string) => Promise<void> | void;
	} = $props();

	const activeImages = $derived(images.filter((image) => !image.deletedAt));
	let editingImage = $state<ManagedProductImage | null>(null);
	let draftCrop = $state({ focusX: 0.5, focusY: 0.5, zoom: 1 });
	let saving = $state(false);
	let message = $state('');

	function imageStyle(image: ManagedProductImage): string {
		const focusX = image.focusX ?? 0.5;
		const focusY = image.focusY ?? 0.5;
		const zoom = image.zoom ?? 1;
		return `object-position: ${focusX * 100}% ${focusY * 100}%; transform: scale(${zoom}); transform-origin: ${focusX * 100}% ${focusY * 100}%;`;
	}

	function openFocusEditor(image: ManagedProductImage) {
		editingImage = image;
		draftCrop = {
			focusX: image.focusX ?? 0.5,
			focusY: image.focusY ?? 0.5,
			zoom: image.zoom ?? 1
		};
		message = '';
	}

	function closeFocusEditor() {
		if (saving) return;
		editingImage = null;
		message = '';
	}

	async function saveCrop() {
		if (!editingImage) return;
		saving = true;
		message = '';
		try {
			await onupdateCrop(editingImage.id, draftCrop);
			editingImage = null;
		} catch (error) {
			message = error instanceof Error ? error.message : '無法更新縮圖裁切。';
		} finally {
			saving = false;
		}
	}
</script>

<div class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
	{#if activeImages.length === 0}
		<p
			class="rounded-md border border-dashed border-border p-4 text-sm text-text-muted sm:col-span-2 lg:col-span-4"
		>
			尚未上傳圖片。
		</p>
	{:else}
		{#each activeImages as image (image.id)}
			<article class="overflow-hidden rounded-md border border-border">
				<div class="relative aspect-square overflow-hidden bg-bg-sunken">
					<img
						src={image.imageUrl}
						alt={image.altText}
						class="h-full w-full object-cover"
						style={imageStyle(image)}
					/>
					{#if image.placement === 'thumbnail'}
						<span
							class="absolute top-2 left-2 rounded-sm bg-bg-surface/90 px-2 py-1 text-[11px] font-semibold text-text-accent"
						>
							縮圖
						</span>
					{/if}
				</div>
				<div class="space-y-2 p-3">
					<p
						class="truncate text-xs text-text-muted"
						title={image.altText}
					>
						{image.altText}
					</p>
					<div class="flex flex-wrap gap-2">
						{#if image.placement === 'thumbnail'}
							<button
								type="button"
								class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs text-text-body hover:bg-bg-sunken"
								aria-label="調整縮圖焦點"
								onclick={() => openFocusEditor(image)}
								title="調整縮圖裁切"
							>
								<Pencil class="size-3.5" />調整焦點
							</button>
						{/if}
						<button
							type="button"
							class="inline-grid size-8 cursor-pointer place-items-center rounded-md text-danger hover:bg-danger-bg"
							aria-label="刪除圖片"
							onclick={() => void ondelete(image.id)}
							title="刪除圖片"
						>
							<Trash2 class="size-4" />
						</button>
					</div>
				</div>
			</article>
		{/each}
	{/if}
</div>

{#if deletedImages.length > 0}
	<div class="border-t border-border bg-bg-sunken p-4">
		<h3 class="text-sm font-semibold text-text-heading">已刪除圖片</h3>
		<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each deletedImages as image (image.id)}
				<article class="overflow-hidden rounded-md border border-border bg-bg-surface">
					<img
						src={image.imageUrl}
						alt={image.altText}
						class="aspect-square w-full object-cover opacity-60"
						style={imageStyle(image)}
					/>
					<div class="flex items-center justify-between gap-2 p-2">
						<span
							class="truncate text-xs text-text-muted"
							title={image.altText}
						>
							{image.altText}
						</span>
						<div class="flex gap-1">
							<button
								type="button"
								class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-xs"
								aria-label="還原圖片"
								onclick={() => void onrestore(image.id)}
								title="還原圖片"
							>
								<RotateCcw class="size-3.5" />還原
							</button>
							<button
								type="button"
								class="inline-grid size-8 cursor-pointer place-items-center rounded-md text-danger hover:bg-danger-bg"
								onclick={() => void onforceDelete(image.id)}
								title="永久刪除圖片"
								aria-label="永久刪除圖片"
							>
								<X class="size-4" />
							</button>
						</div>
					</div>
				</article>
			{/each}
		</div>
	</div>
{/if}

<Drawer
	open={editingImage !== null}
	title="調整縮圖焦點"
	onclose={closeFocusEditor}
>
	{#if editingImage}
		<div class="space-y-4">
			<p class="text-sm text-text-muted">調整後會立即套用到商品目錄的 1:1 縮圖。</p>
			{#key editingImage.id}
				<ProductImageFocusPicker
					imageUrl={editingImage.imageUrl}
					altText={editingImage.altText}
					initialFocusX={draftCrop.focusX}
					initialFocusY={draftCrop.focusY}
					initialZoom={draftCrop.zoom}
					onchange={(crop) => (draftCrop = crop)}
				/>
			{/key}
			{#if message}
				<p
					class="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"
					role="alert"
				>
					{message}
				</p>
			{/if}
			<button
				type="button"
				disabled={saving}
				class="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
				onclick={() => void saveCrop()}
			>
				{saving ? '儲存中...' : '儲存裁切'}
			</button>
		</div>
	{/if}
</Drawer>
