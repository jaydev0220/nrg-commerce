<script lang="ts">
	import { X } from '@lucide/svelte';
	import { AdminApiError } from '$lib/api/admin-api';
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import type { ManagedProductSku } from '$lib/api/admin-api';
	import type { ProductAttributeRow, ProductSkuInput } from './types';

	let {
		open,
		sku,
		onclose,
		onsave
	}: {
		open: boolean;
		sku: ManagedProductSku | null;
		onclose: () => void;
		onsave: (input: ProductSkuInput) => Promise<void>;
	} = $props();

	function initialAttributeRows(source: ManagedProductSku | null): ProductAttributeRow[] {
		return source
			? Object.entries(source.attributes).map(([key, value], index) => ({
					id: index,
					key,
					value: String(value)
				}))
			: [{ id: 0, key: '', value: '' }];
	}

	let attributeRows = $derived(initialAttributeRows(sku));
	let errorMessage = $state('');
	let busy = $state(false);

	function message(error: unknown): string {
		return error instanceof AdminApiError || error instanceof Error
			? error.message
			: '無法儲存 SKU。';
	}

	function removeAttribute(index: number) {
		attributeRows = attributeRows.filter((_, rowIndex) => rowIndex !== index);
	}

	function addAttribute() {
		const nextId = attributeRows.reduce((maxId, row) => Math.max(maxId, row.id), -1) + 1;
		attributeRows = [...attributeRows, { id: nextId, key: '', value: '' }];
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		const values = new FormData(event.currentTarget as HTMLFormElement);
		const skuCode = String(values.get('skuCode') ?? '').trim();
		const price = Number(values.get('price'));
		const stockQuantity = Number(values.get('stockQuantity'));
		if (
			!skuCode ||
			!Number.isFinite(price) ||
			price < 0 ||
			!Number.isInteger(stockQuantity) ||
			stockQuantity < 0
		) {
			errorMessage = '請填寫 SKU 代碼、有效價格與非負整數庫存。';
			return;
		}
		const keys = values.getAll('attributeKey').map((value) => String(value).trim());
		const attributeValues = values.getAll('attributeValue').map(String);
		const attributes = Object.fromEntries(
			keys.map((key, index) => [key, attributeValues[index] ?? ''] as const).filter(([key]) => key)
		);
		busy = true;
		try {
			await onsave({ skuCode, price, stockQuantity, attributes });
			onclose();
		} catch (error) {
			errorMessage = message(error);
		} finally {
			busy = false;
		}
	}
</script>

<Drawer
	{open}
	title={sku ? '編輯 SKU' : '新增 SKU'}
	{onclose}
>
	<form
		class="space-y-4"
		onsubmit={submit}
	>
		{#if errorMessage}
			<p
				class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
				role="alert"
			>
				{errorMessage}
			</p>
		{/if}
		<label class="block text-sm font-medium">
			SKU 代碼
			<input
				required
				name="skuCode"
				value={sku?.skuCode ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			價格
			<input
				required
				min="0"
				step="0.01"
				type="number"
				name="price"
				value={sku?.price ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			庫存數量
			<input
				required
				min="0"
				step="1"
				type="number"
				name="stockQuantity"
				value={sku?.stockQuantity ?? 0}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<fieldset>
			<legend class="mb-2 text-sm font-medium">規格屬性</legend>
			<div class="space-y-2">
				{#each attributeRows as row, index (row.id)}
					<div class="grid grid-cols-[1fr_1fr_auto] gap-2">
						<input
							name="attributeKey"
							bind:value={row.key}
							aria-label="屬性名稱"
							placeholder="例如：顏色"
							class="h-10 rounded-md border border-border bg-bg-surface px-3"
						/>
						<input
							name="attributeValue"
							bind:value={row.value}
							aria-label="屬性值"
							placeholder="例如：黑色"
							class="h-10 rounded-md border border-border bg-bg-surface px-3"
						/>
						<button
							type="button"
							class="inline-grid size-10 cursor-pointer place-items-center"
							aria-label="移除屬性"
							onclick={() => removeAttribute(index)}
						>
							<X class="size-4" />
						</button>
					</div>
				{/each}
			</div>
			<button
				type="button"
				class="mt-2 cursor-pointer text-sm text-text-accent"
				onclick={addAttribute}
			>
				新增屬性
			</button>
		</fieldset>
		<button
			type="submit"
			disabled={busy}
			class="h-10 w-full cursor-pointer rounded-md bg-brand text-sm font-semibold text-text-on-accent disabled:cursor-not-allowed disabled:opacity-55"
		>
			{busy ? '儲存中...' : '儲存 SKU'}
		</button>
	</form>
</Drawer>
