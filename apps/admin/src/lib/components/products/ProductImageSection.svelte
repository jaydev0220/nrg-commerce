<script lang="ts">
	import { ImagePlus } from '@lucide/svelte';

	import {
		AdminApiError,
		type ManagedProductImage,
		type ManagedProductSku
	} from '$lib/api/admin-api';
	import ProductImageGrid from './ProductImageGrid.svelte';
	import ProductImageUploadDrawer from './ProductImageUploadDrawer.svelte';
	import type { ProductImageUploadInput } from './types';

	let {
		images,
		deletedImages,
		skus,
		onupload,
		onupdateCrop,
		ondelete,
		onrestore,
		onforceDelete
	}: {
		images: ManagedProductImage[];
		deletedImages: ManagedProductImage[];
		skus: ManagedProductSku[];
		onupload: (input: ProductImageUploadInput) => Promise<void>;
		onupdateCrop: (
			imageId: string,
			input: { focusX: number; focusY: number; zoom: number }
		) => Promise<void>;
		ondelete: (imageId: string) => Promise<void>;
		onrestore: (imageId: string) => Promise<void>;
		onforceDelete: (imageId: string) => Promise<void>;
	} = $props();

	let uploadOpen = $state(false);
	let message = $state('');

	function getErrorMessage(error: unknown, fallback: string) {
		return error instanceof AdminApiError || error instanceof Error ? error.message : fallback;
	}

	async function perform(action: () => Promise<void>, success: string, failure: string) {
		message = '';
		try {
			await action();
			message = success;
		} catch (error) {
			message = getErrorMessage(error, failure);
			throw error;
		}
	}
</script>

<section class="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-xs">
	<header class="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
		<h2 class="text-lg font-semibold text-text-heading">商品圖片</h2>
		<button
			type="button"
			class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent"
			onclick={() => (uploadOpen = true)}
		>
			<ImagePlus class="size-4" />上傳圖片
		</button>
	</header>
	{#if message}
		<p
			class="m-4 rounded-md border border-border bg-bg-sunken p-3 text-sm"
			role="status"
		>
			{message}
		</p>
	{/if}
	<ProductImageGrid
		{images}
		{deletedImages}
		{onupdateCrop}
		ondelete={(imageId) => perform(() => ondelete(imageId), '已刪除圖片。', '無法刪除圖片。')}
		onrestore={(imageId) => perform(() => onrestore(imageId), '已還原圖片。', '無法還原圖片。')}
		onforceDelete={(imageId) =>
			perform(() => onforceDelete(imageId), '已永久刪除圖片。', '無法永久刪除圖片。')}
	/>
</section>

<ProductImageUploadDrawer
	open={uploadOpen}
	{skus}
	onclose={() => (uploadOpen = false)}
	onupload={(input) =>
		perform(
			async () => {
				await onupload(input);
				uploadOpen = false;
			},
			'已上傳圖片。',
			'無法上傳圖片。'
		)}
/>
