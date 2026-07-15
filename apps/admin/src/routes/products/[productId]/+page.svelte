<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	import {
		createImageUploadTarget,
		createProductSku,
		deleteProductImage,
		deleteProductSku,
		registerProductImage,
		restoreProductImage,
		updateProductImageCrop,
		updateProduct,
		updateProductSku
	} from '$lib/api/admin-api';
	import ProductProfileForm from '$lib/components/products/ProductProfileForm.svelte';
	import ProductSkuSection from '$lib/components/products/ProductSkuSection.svelte';
	import type {
		ProductImageUploadInput,
		ProductProfileInput,
		ProductSkuInput
	} from '$lib/components/products/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	async function saveProduct(input: ProductProfileInput) {
		await updateProduct(data.product.id, input);
		await invalidateAll();
	}

	async function createSku(input: ProductSkuInput) {
		await createProductSku({ productId: data.product.id, ...input });
		await invalidateAll();
	}

	async function updateSku(skuId: string, input: ProductSkuInput) {
		await updateProductSku(skuId, input);
		await invalidateAll();
	}

	async function deleteSku(skuId: string) {
		await deleteProductSku(skuId);
		await invalidateAll();
	}

	async function uploadImage(input: ProductImageUploadInput) {
		const target = await createImageUploadTarget(input.skuId, {
			fileName: input.file.name,
			contentType: input.file.type,
			fileSize: input.file.size
		});
		const uploadResponse = await fetch(target.uploadUrl, {
			method: 'PUT',
			headers: { 'content-type': input.file.type },
			body: input.file,
			credentials: 'omit'
		});
		if (!uploadResponse.ok) throw new Error('圖片上傳失敗。');
		await registerProductImage(input.skuId, {
			uploadId: target.uploadId,
			altText: input.altText,
			type: input.type,
			focusX: input.type === 'thumbnail' ? input.focusX : null,
			focusY: input.type === 'thumbnail' ? input.focusY : null,
			zoom: input.type === 'thumbnail' ? input.zoom : null
		});
		await invalidateAll();
	}

	async function updateImageCrop(
		skuId: string,
		imageId: string,
		input: { focusX: number; focusY: number; zoom: number }
	) {
		await updateProductImageCrop(skuId, imageId, input);
		await invalidateAll();
	}

	async function deleteImage(skuId: string, imageId: string) {
		await deleteProductImage(skuId, imageId);
		await invalidateAll();
	}

	async function restoreImage(skuId: string, imageId: string) {
		await restoreProductImage(skuId, imageId);
		await invalidateAll();
	}

	async function forceDeleteImage(skuId: string, imageId: string) {
		await deleteProductImage(skuId, imageId, { force: true, deleteAsset: true });
		await invalidateAll();
	}
</script>

<svelte:head><title>{data.product.name} | 商品管理</title></svelte:head>

<div class="space-y-5">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<a
				href={resolve('/products')}
				class="mb-2 inline-flex items-center gap-1 text-sm text-text-muted"
			>
				<ArrowLeft class="size-4" />返回商品列表
			</a>
			<h1 class="text-xl font-semibold text-text-heading">{data.product.name}</h1>
			<p class="text-sm text-text-muted">管理商品資料、SKU 與商品圖片</p>
		</div>
	</header>

	<ProductProfileForm
		product={data.product}
		categories={data.categories}
		onsave={saveProduct}
	/>
	<ProductSkuSection
		skus={data.product.skus}
		deletedImages={data.deletedImages}
		oncreateSku={createSku}
		onupdateSku={updateSku}
		ondeleteSku={deleteSku}
		onuploadImage={uploadImage}
		onupdateImageCrop={updateImageCrop}
		ondeleteImage={deleteImage}
		onrestoreImage={restoreImage}
		onforceDeleteImage={forceDeleteImage}
	/>
</div>
