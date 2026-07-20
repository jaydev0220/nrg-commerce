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
	import ProductImageSection from '$lib/components/products/ProductImageSection.svelte';
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
		const target = await createImageUploadTarget(data.product.id, {
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
		await registerProductImage(data.product.id, {
			uploadId: target.uploadId,
			skuId: input.skuId,
			altText: input.altText,
			placement: input.placement,
			focusX: input.placement === 'thumbnail' ? input.focusX : null,
			focusY: input.placement === 'thumbnail' ? input.focusY : null,
			zoom: input.placement === 'thumbnail' ? input.zoom : null
		});
		await invalidateAll();
	}

	async function updateImageCrop(
		imageId: string,
		input: { focusX: number; focusY: number; zoom: number }
	) {
		await updateProductImageCrop(data.product.id, imageId, input);
		await invalidateAll();
	}

	async function deleteImage(imageId: string) {
		await deleteProductImage(data.product.id, imageId);
		await invalidateAll();
	}

	async function restoreImage(imageId: string) {
		await restoreProductImage(data.product.id, imageId);
		await invalidateAll();
	}

	async function forceDeleteImage(imageId: string) {
		await deleteProductImage(data.product.id, imageId, { force: true, deleteAsset: true });
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
		oncreateSku={createSku}
		onupdateSku={updateSku}
		ondeleteSku={deleteSku}
	/>
	<ProductImageSection
		images={data.product.images}
		deletedImages={data.deletedImages}
		skus={data.product.skus}
		onupload={uploadImage}
		onupdateCrop={updateImageCrop}
		ondelete={deleteImage}
		onrestore={restoreImage}
		onforceDelete={forceDeleteImage}
	/>
</div>
