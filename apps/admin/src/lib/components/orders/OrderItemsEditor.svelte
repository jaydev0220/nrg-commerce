<script lang="ts">
	import { PackageSearch, Plus, Trash2, Wrench } from '@lucide/svelte';

	import type { ManagedOrderSkuLookup } from '$lib/api/admin-api';
	import SkuCombobox from './SkuCombobox.svelte';
	import { createCustomDraft, createSkuDraft, type OrderItemDraft } from './order-editor';

	let { items = $bindable(), disabled = false }: { items: OrderItemDraft[]; disabled?: boolean } =
		$props();

	function replaceItem(key: string, replacement: OrderItemDraft) {
		items = items.map((item) => (item.key === key ? replacement : item));
	}

	function addSku(sku: ManagedOrderSkuLookup) {
		items = [...items, createSkuDraft(sku)];
	}

	function addCustom() {
		items = [...items, createCustomDraft()];
	}

	function removeItem(key: string) {
		items = items.filter((item) => item.key !== key);
	}

	function updateItem(key: string, changes: Partial<OrderItemDraft>) {
		items = items.map((item) => (item.key === key ? { ...item, ...changes } : item));
	}
</script>

<section
	class="space-y-3"
	aria-labelledby="order-items-heading"
>
	<div class="flex flex-wrap items-end gap-2">
		<div class="min-w-56 flex-1">
			<h3
				id="order-items-heading"
				class="mb-2 text-sm font-semibold text-text-heading"
			>
				訂單品項
			</h3>
			<SkuCombobox
				onselect={addSku}
				{disabled}
			/>
		</div>
		<button
			type="button"
			class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-60"
			onclick={addCustom}
			{disabled}
		>
			<Plus class="size-4" />自訂品項
		</button>
	</div>

	<div class="space-y-3">
		{#each items as item, index (item.key)}
			<article class="rounded-md border border-border bg-bg-sunken p-3">
				<header class="mb-3 flex items-start justify-between gap-3">
					<div class="flex min-w-0 items-center gap-2">
						{#if item.productSkuId}<PackageSearch
								class="size-4 shrink-0 text-brand"
							/>{:else}<Wrench class="size-4 shrink-0 text-warning" />{/if}
						<div class="min-w-0">
							<p class="truncate text-sm font-semibold text-text-heading">
								品項 {index + 1} · {item.productSkuId ? '商品 SKU' : '自訂品項'}
							</p>
							{#if item.productSkuId}<p class="truncate text-xs text-text-muted">
									{item.productName} · {item.skuCode} · NT$ {item.unitPrice.toLocaleString('zh-TW')}
								</p>{/if}
						</div>
					</div>
					<button
						type="button"
						class="inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-danger hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
						onclick={() => removeItem(item.key)}
						aria-label={`移除品項 ${index + 1}`}
						title="移除品項"
						{disabled}
					>
						<Trash2 class="size-4" />
					</button>
				</header>

				{#if item.productSkuId}
					<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
						<div>
							<p class="mb-1 text-xs font-medium text-text-muted">改用其他商品 SKU</p>
							<SkuCombobox
								onselect={(sku) => replaceItem(item.key, createSkuDraft(sku, item))}
								{disabled}
							/>
						</div>
						<label class="text-sm font-medium">
							數量
							<input
								type="number"
								min="1"
								step="1"
								value={item.quantity}
								oninput={(event) =>
									updateItem(item.key, { quantity: event.currentTarget.valueAsNumber })}
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								{disabled}
							/>
						</label>
					</div>
					<button
						type="button"
						class="mt-3 cursor-pointer text-sm font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-60"
						onclick={() => replaceItem(item.key, createCustomDraft(item))}
						{disabled}
					>
						改為自訂品項
					</button>
				{:else}
					<div class="mb-3">
						<p class="mb-1 text-xs font-medium text-text-muted">改用商品 SKU</p>
						<SkuCombobox
							onselect={(sku) => replaceItem(item.key, createSkuDraft(sku, item))}
							{disabled}
						/>
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="text-sm font-medium">
							品名
							<input
								value={item.productName}
								oninput={(event) =>
									updateItem(item.key, { productName: event.currentTarget.value })}
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								maxlength="160"
								{disabled}
							/>
						</label>
						<label class="text-sm font-medium">
							品項編號
							<input
								value={item.skuCode}
								oninput={(event) => updateItem(item.key, { skuCode: event.currentTarget.value })}
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								maxlength="80"
								{disabled}
							/>
						</label>
						<label class="text-sm font-medium">
							單價
							<input
								type="number"
								min="0"
								step="0.01"
								value={item.unitPrice}
								oninput={(event) =>
									updateItem(item.key, { unitPrice: event.currentTarget.valueAsNumber })}
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								{disabled}
							/>
						</label>
						<label class="text-sm font-medium">
							數量
							<input
								type="number"
								min="1"
								step="1"
								value={item.quantity}
								oninput={(event) =>
									updateItem(item.key, { quantity: event.currentTarget.valueAsNumber })}
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								{disabled}
							/>
						</label>
					</div>
				{/if}
			</article>
		{:else}
			<p class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger">
				訂單至少需要一個品項。
			</p>
		{/each}
	</div>
</section>
