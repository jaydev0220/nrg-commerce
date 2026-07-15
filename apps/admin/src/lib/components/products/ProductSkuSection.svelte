<script lang="ts">
	import { Plus } from '@lucide/svelte';

	import {
		AdminApiError,
		type ManagedProductImage,
		type ManagedProductSku
	} from '$lib/api/admin-api';
	import ProductImageUploadDrawer from './ProductImageUploadDrawer.svelte';
	import ProductSkuCard from './ProductSkuCard.svelte';
	import ProductSkuEditorDrawer from './ProductSkuEditorDrawer.svelte';
	import type { ProductImageUploadInput, ProductSkuInput } from './types';

	let {
		skus,
		deletedImages,
		oncreateSku,
		onupdateSku,
		ondeleteSku,
		onuploadImage,
		onupdateImageFocus,
		ondeleteImage,
		onrestoreImage,
		onforceDeleteImage
	}: {
		skus: ManagedProductSku[];
		deletedImages: Record<string, ManagedProductImage[]>;
		oncreateSku: (input: ProductSkuInput) => Promise<void>;
		onupdateSku: (skuId: string, input: ProductSkuInput) => Promise<void>;
		ondeleteSku: (skuId: string) => Promise<void>;
		onuploadImage: (input: ProductImageUploadInput) => Promise<void>;
		onupdateImageFocus: (
			skuId: string,
			imageId: string,
			input: { focusX: number; focusY: number }
		) => Promise<void>;
		ondeleteImage: (skuId: string, imageId: string) => Promise<void>;
		onrestoreImage: (skuId: string, imageId: string) => Promise<void>;
		onforceDeleteImage: (skuId: string, imageId: string) => Promise<void>;
	} = $props();

	let editingSku = $state<ManagedProductSku | null>(null);
	let skuDrawer = $state(false);
	let skuDrawerKey = $state(0);
	let imageSkuId = $state<string | null>(null);
	let message = $state('');

	function errorMessage(error: unknown, fallback: string): string {
		return error instanceof AdminApiError || error instanceof Error ? error.message : fallback;
	}

	function openSku(sku?: ManagedProductSku) {
		editingSku = sku ?? null;
		skuDrawerKey += 1;
		skuDrawer = true;
	}

	async function saveSku(input: ProductSkuInput) {
		message = '';
		const wasEditing = editingSku !== null;
		try {
			if (editingSku) await onupdateSku(editingSku.id, input);
			else await oncreateSku(input);
			skuDrawer = false;
			editingSku = null;
			message = wasEditing ? '已更新 SKU。' : '已新增 SKU。';
		} catch (error) {
			message = errorMessage(error, '無法儲存 SKU。');
			throw error;
		}
	}

	async function removeSku(skuId: string) {
		message = '';
		try {
			await ondeleteSku(skuId);
			message = '已刪除 SKU。';
		} catch (error) {
			message = errorMessage(error, '無法刪除 SKU。');
		}
	}

	async function uploadImage(input: ProductImageUploadInput) {
		message = '';
		try {
			await onuploadImage(input);
			imageSkuId = null;
			message = '已上傳圖片。';
		} catch (error) {
			message = errorMessage(error, '無法上傳圖片。');
			throw error;
		}
	}

	async function deleteImage(skuId: string, imageId: string) {
		try {
			await ondeleteImage(skuId, imageId);
			message = '已刪除圖片。';
		} catch (error) {
			message = errorMessage(error, '無法刪除圖片。');
		}
	}

	async function restoreImage(skuId: string, imageId: string) {
		try {
			await onrestoreImage(skuId, imageId);
			message = '已還原圖片。';
		} catch (error) {
			message = errorMessage(error, '無法還原圖片。');
		}
	}

	async function forceDeleteImage(skuId: string, imageId: string) {
		try {
			await onforceDeleteImage(skuId, imageId);
			message = '已永久刪除圖片。';
		} catch (error) {
			message = errorMessage(error, '無法永久刪除圖片。');
		}
	}
</script>

<section class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-lg font-semibold text-text-heading">SKU 與圖片</h2>
		<button
			type="button"
			class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent"
			onclick={() => openSku()}
		>
			<Plus class="size-4" />新增 SKU
		</button>
	</div>
	{#if message}
		<p
			class="rounded-md border border-border bg-bg-sunken p-3 text-sm text-text-body"
			role="status"
		>
			{message}
		</p>
	{/if}
	{#if skus.length === 0}
		<p class="rounded-lg border border-dashed border-border p-8 text-center text-text-muted">
			尚未建立 SKU。
		</p>
	{:else}
		{#each skus as sku (sku.id)}
			<ProductSkuCard
				{sku}
				deletedImages={deletedImages[sku.id] ?? []}
				onedit={() => openSku(sku)}
				ondelete={() => void removeSku(sku.id)}
				onupload={() => (imageSkuId = sku.id)}
				onupdateImageFocus={(imageId, input) => onupdateImageFocus(sku.id, imageId, input)}
				ondeleteImage={(imageId) => deleteImage(sku.id, imageId)}
				onrestoreImage={(imageId) => restoreImage(sku.id, imageId)}
				onforceDeleteImage={(imageId) => forceDeleteImage(sku.id, imageId)}
			/>
		{/each}
	{/if}
</section>

{#key skuDrawerKey}
	<ProductSkuEditorDrawer
		open={skuDrawer}
		sku={editingSku}
		onclose={() => {
			skuDrawer = false;
			editingSku = null;
		}}
		onsave={saveSku}
	/>
{/key}
<ProductImageUploadDrawer
	open={imageSkuId !== null}
	skuId={imageSkuId}
	onclose={() => (imageSkuId = null)}
	onupload={uploadImage}
/>
