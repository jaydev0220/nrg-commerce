<script lang="ts">
	import { CheckCircle2, FileImage, ImagePlus, Replace, UploadCloud } from '@lucide/svelte';

	import { AdminApiError, type ManagedProductSku } from '$lib/api/admin-api';
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import ProductImageFocusPicker from './ProductImageFocusPicker.svelte';
	import type { ProductImageUploadInput } from './types';

	const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
	const maxFileSize = 10 * 1024 * 1024;

	let {
		open,
		skus,
		onclose,
		onupload
	}: {
		open: boolean;
		skus: ManagedProductSku[];
		onclose: () => void;
		onupload: (input: ProductImageUploadInput) => Promise<void>;
	} = $props();

	let fileInput = $state<HTMLInputElement>();
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state('');
	let imageDimensions = $state<{ width: number; height: number } | null>(null);
	let placement = $state<'thumbnail' | 'shared-gallery' | 'sku-gallery'>('shared-gallery');
	let skuId = $state<string | null>(null);
	let altText = $state('');
	let focusX = $state(0.5);
	let focusY = $state(0.5);
	let zoom = $state(1);
	let errorMessage = $state('');
	let busy = $state(false);
	let dragging = $state(false);

	function message(error: unknown): string {
		return error instanceof AdminApiError || error instanceof Error
			? error.message
			: '無法上傳圖片。';
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function clearPreviewUrl() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = '';
	}

	function reset() {
		clearPreviewUrl();
		selectedFile = null;
		imageDimensions = null;
		placement = 'shared-gallery';
		skuId = null;
		altText = '';
		focusX = 0.5;
		focusY = 0.5;
		zoom = 1;
		errorMessage = '';
		busy = false;
		dragging = false;
		if (fileInput) fileInput.value = '';
	}

	function close() {
		if (busy) return;
		reset();
		onclose();
	}

	function validateFile(file: File): string | null {
		if (!acceptedTypes.has(file.type)) return '請選擇 JPEG、PNG、WebP 或 AVIF 圖片。';
		if (file.size > maxFileSize) return '圖片大小不可超過 10 MB。';
		return null;
	}

	async function selectFile(file: File | undefined) {
		if (!file) return;
		errorMessage = validateFile(file) ?? '';
		if (errorMessage) return;
		clearPreviewUrl();
		selectedFile = file;
		previewUrl = URL.createObjectURL(file);
		focusX = 0.5;
		focusY = 0.5;
		zoom = 1;
		try {
			imageDimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
				const image = new Image();
				image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
				image.onerror = () => reject(new Error('無法讀取圖片尺寸。'));
				image.src = previewUrl;
			});
		} catch (error) {
			selectedFile = null;
			clearPreviewUrl();
			errorMessage = message(error);
		}
	}

	function handleFileChange(event: Event) {
		void selectFile((event.currentTarget as HTMLInputElement).files?.[0]);
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		void selectFile(event.dataTransfer?.files[0]);
	}

	async function submit() {
		errorMessage = '';
		if (!selectedFile) {
			errorMessage = '請先選擇圖片。';
			return;
		}
		if (placement === 'sku-gallery' && !skuId) {
			errorMessage = '請選擇此圖片適用的 SKU。';
			return;
		}
		if (!altText.trim()) {
			errorMessage = '請填寫替代文字。';
			return;
		}
		busy = true;
		try {
			await onupload({
				skuId,
				file: selectedFile,
				altText: altText.trim(),
				placement,
				focusX: placement === 'thumbnail' ? focusX : null,
				focusY: placement === 'thumbnail' ? focusY : null,
				zoom: placement === 'thumbnail' ? zoom : null
			});
			busy = false;
			close();
		} catch (error) {
			errorMessage = message(error);
		} finally {
			busy = false;
		}
	}
</script>

<Drawer
	{open}
	title="上傳商品圖片"
	onclose={close}
>
	<div class="space-y-5">
		{#if errorMessage}
			<p
				class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
				role="alert"
			>
				{errorMessage}
			</p>
		{/if}

		{#if selectedFile && previewUrl}
			<section class="space-y-4">
				<div class="flex items-start justify-between gap-3">
					<div class="flex min-w-0 items-center gap-3">
						<div
							class="grid size-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-text-accent"
						>
							<FileImage class="size-5" />
						</div>
						<div class="min-w-0">
							<p class="truncate text-sm font-semibold text-text-heading">{selectedFile.name}</p>
							<p class="text-xs text-text-muted">
								{formatBytes(selectedFile.size)}
								{#if imageDimensions}
									· {imageDimensions.width} × {imageDimensions.height} px
								{/if}
							</p>
						</div>
					</div>
					<button
						type="button"
						class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-bg-sunken"
						aria-label="替換圖片"
						title="替換圖片"
						onclick={() => fileInput?.click()}
					>
						<Replace class="size-4" />替換
					</button>
				</div>

				{#if placement === 'thumbnail'}
					<div>
						<div class="mb-2 flex items-end justify-between gap-3">
							<div>
								<h3 class="text-sm font-semibold text-text-heading">設定縮圖焦點</h3>
								<p class="mt-1 text-xs text-text-muted">商品目錄會以 1:1 比例顯示這張圖片。</p>
							</div>
							<span class="text-xs text-text-muted tabular-nums">
								{Math.round(focusX * 100)}%, {Math.round(focusY * 100)}%
							</span>
						</div>
						<ProductImageFocusPicker
							imageUrl={previewUrl}
							altText={altText || '商品縮圖預覽'}
							onchange={(focus) => {
								focusX = focus.focusX;
								focusY = focus.focusY;
								zoom = focus.zoom;
							}}
						/>
					</div>
				{:else}
					<div class="overflow-hidden rounded-md border border-border bg-bg-sunken">
						<img
							src={previewUrl}
							alt={altText || selectedFile.name}
							class="max-h-72 w-full object-contain"
						/>
					</div>
				{/if}
			</section>
		{:else}
			<button
				type="button"
				class={`flex min-h-64 w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-6 text-center transition-colors ${dragging ? 'border-brand bg-brand-subtle' : 'border-border-strong bg-bg-sunken hover:border-brand hover:bg-brand-subtle'}`}
				onclick={() => fileInput?.click()}
				ondragover={(event) => {
					event.preventDefault();
					dragging = true;
				}}
				ondragleave={() => (dragging = false)}
				ondrop={handleDrop}
			>
				<span class="grid size-14 place-items-center rounded-full bg-brand-subtle text-text-accent">
					<UploadCloud class="size-7" />
				</span>
				<span>
					<strong class="block text-sm font-semibold text-text-heading">拖曳圖片到這裡</strong>
					<span class="mt-1 block text-xs text-text-muted">或點擊選擇檔案</span>
				</span>
				<span class="text-xs text-text-subtle">JPEG、PNG、WebP、AVIF · 最大 10 MB</span>
			</button>
		{/if}

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block text-sm font-medium text-text-heading sm:col-span-2">
				替代文字
				<input
					bind:value={altText}
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
					placeholder="例如：黑色外殼正面"
					maxlength="160"
				/>
			</label>
			<label class="block text-sm font-medium text-text-heading sm:col-span-2">
				圖片用途
				<select
					bind:value={placement}
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
				>
					<option value="shared-gallery">共用圖庫</option>
					<option value="thumbnail">商品縮圖</option>
					<option value="sku-gallery">指定 SKU 圖庫</option>
				</select>
			</label>
			{#if placement === 'sku-gallery'}
				<label class="block text-sm font-medium text-text-heading sm:col-span-2">
					適用 SKU
					<select
						bind:value={skuId}
						class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
					>
						<option value={null}>請選擇</option>
						{#each skus as sku (sku.id)}
							<option value={sku.id}>{sku.skuCode}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<div class="flex items-start gap-2 rounded-md bg-bg-sunken p-3 text-xs text-text-muted">
			<CheckCircle2 class="mt-0.5 size-4 shrink-0 text-success" />
			<span>圖片會先上傳到安全的暫存位置，確認完成後才會加入商品。</span>
		</div>

		<input
			bind:this={fileInput}
			type="file"
			accept="image/jpeg,image/png,image/webp,image/avif"
			class="sr-only"
			onchange={handleFileChange}
		/>
		<button
			type="button"
			disabled={busy || !selectedFile}
			class="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
			onclick={() => void submit()}
		>
			<ImagePlus class="size-4" />{busy ? '上傳中...' : '上傳圖片'}
		</button>
	</div>
</Drawer>
