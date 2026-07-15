<script lang="ts">
	import { ImagePlus, Pencil, Trash2 } from '@lucide/svelte';

	import type { ManagedProductSku } from '$lib/api/admin-api';
	import ProductImageGrid from './ProductImageGrid.svelte';

	let {
		sku,
		deletedImages,
		onedit,
		ondelete,
		onupload,
		onupdateImageCrop,
		ondeleteImage,
		onrestoreImage,
		onforceDeleteImage
	}: {
		sku: ManagedProductSku;
		deletedImages: ManagedProductSku['images'];
		onedit: () => void;
		ondelete: () => void;
		onupload: () => void;
		onupdateImageCrop: (
			imageId: string,
			input: { focusX: number; focusY: number; zoom: number }
		) => Promise<void> | void;
		ondeleteImage: (imageId: string) => Promise<void> | void;
		onrestoreImage: (imageId: string) => Promise<void> | void;
		onforceDeleteImage: (imageId: string) => Promise<void> | void;
	} = $props();
</script>

<section class="rounded-lg border border-border bg-bg-surface shadow-xs">
	<header class="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
		<div>
			<h2 class="font-semibold text-text-heading">{sku.skuCode}</h2>
			<p class="text-sm text-text-muted">NT$ {sku.price.toLocaleString('zh-TW')}</p>
		</div>
		<div class="flex gap-2">
			<button
				type="button"
				class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm"
				aria-label="編輯 SKU"
				onclick={onedit}
			>
				<Pencil class="size-4" />編輯
			</button>
			<button
				type="button"
				class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm text-danger"
				aria-label="刪除 SKU"
				onclick={ondelete}
			>
				<Trash2 class="size-4" />刪除
			</button>
			<button
				type="button"
				class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm"
				aria-label="上傳圖片"
				onclick={onupload}
			>
				<ImagePlus class="size-4" />上傳圖片
			</button>
		</div>
	</header>
	<ProductImageGrid
		images={sku.images}
		{deletedImages}
		onupdateCrop={onupdateImageCrop}
		ondelete={ondeleteImage}
		onrestore={onrestoreImage}
		onforceDelete={onforceDeleteImage}
	/>
</section>
