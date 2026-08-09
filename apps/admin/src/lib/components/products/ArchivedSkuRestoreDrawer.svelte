<script lang="ts">
	import { X } from '@lucide/svelte';

	import { AdminApiError, type ManagedProduct, type ManagedProductSku } from '$lib/api/admin-api';
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import type { ArchivedSkuRestoreInput, ProductAttributeRow } from './types';

	let {
		sku,
		products,
		onclose,
		onrestore
	}: {
		sku: ManagedProductSku | null;
		products: ManagedProduct[];
		onclose: () => void;
		onrestore: (skuId: string, input: ArchivedSkuRestoreInput) => Promise<void>;
	} = $props();

	function initialAttributeRows(source: ManagedProductSku | null): ProductAttributeRow[] {
		return source
			? Object.entries(source.attributes).map(([key, value], index) => ({
					id: index,
					key,
					value: String(value)
				}))
			: [];
	}

	let attributeRows = $derived(initialAttributeRows(sku));
	let errorMessage = $state('');
	let busy = $state(false);

	function message(error: unknown): string {
		return error instanceof AdminApiError || error instanceof Error
			? error.message
			: '無法還原 SKU。';
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
		if (!sku) return;
		errorMessage = '';
		const values = new FormData(event.currentTarget as HTMLFormElement);
		const productId = String(values.get('productId') ?? '');
		const skuCode = String(values.get('skuCode') ?? '').trim();
		const price = Number(values.get('price'));
		const stockQuantity = Number(values.get('stockQuantity'));
		if (
			!productId ||
			!skuCode ||
			!Number.isFinite(price) ||
			price < 0 ||
			!Number.isInteger(stockQuantity) ||
			stockQuantity < 0
		) {
			errorMessage = '請選擇商品，並填寫有效的 SKU 代碼、價格與庫存。';
			return;
		}
		const keys = values.getAll('attributeKey').map((value) => String(value).trim());
		const attributeValues = values.getAll('attributeValue').map(String);
		const attributes = Object.fromEntries(
			keys.map((key, index) => [key, attributeValues[index] ?? ''] as const).filter(([key]) => key)
		);
		busy = true;
		try {
			await onrestore(sku.id, {
				productId,
				skuCode,
				price,
				stockQuantity,
				attributes,
				notes: String(values.get('notes') ?? '').trim() || null
			});
			onclose();
		} catch (error) {
			errorMessage = message(error);
		} finally {
			busy = false;
		}
	}
</script>

<Drawer
	open={sku !== null}
	title="還原 SKU"
	{onclose}
>
	{#if sku}
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
				所屬商品
				<select
					required
					name="productId"
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
				>
					{#each products as product (product.id)}
						<option
							value={product.id}
							selected={product.id === sku.productId}
						>
							{product.name}
						</option>
					{/each}
				</select>
			</label>
			<label class="block text-sm font-medium">
				SKU 代碼
				<input
					required
					name="skuCode"
					value={sku.skuCode}
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
				/>
			</label>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="block text-sm font-medium">
					價格
					<input
						required
						min="0"
						step="0.01"
						type="number"
						name="price"
						value={sku.price}
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
						value={sku.stockQuantity}
						class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
					/>
				</label>
			</div>
			<label class="block text-sm font-medium">
				備註
				<textarea
					name="notes"
					maxlength="10000"
					rows="3"
					class="mt-1 w-full rounded-md border border-border bg-bg-surface p-3">{sku.notes ??
						''}</textarea>
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
								class="h-10 rounded-md border border-border bg-bg-surface px-3"
							/>
							<input
								name="attributeValue"
								bind:value={row.value}
								aria-label="屬性值"
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
				disabled={busy || products.length === 0}
				class="h-10 w-full cursor-pointer rounded-md bg-brand text-sm font-semibold text-text-on-accent disabled:cursor-not-allowed disabled:opacity-55"
			>
				{busy ? '還原中...' : '確認還原'}
			</button>
		</form>
	{/if}
</Drawer>
