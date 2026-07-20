<script lang="ts">
	import { Pencil, Trash2 } from '@lucide/svelte';

	import type { ManagedProductSku } from '$lib/api/admin-api';

	let {
		sku,
		onedit,
		ondelete
	}: {
		sku: ManagedProductSku;
		onedit: () => void;
		ondelete: () => void;
	} = $props();
</script>

<section class="rounded-lg border border-border bg-bg-surface shadow-xs">
	<header class="flex flex-wrap items-center justify-between gap-3 p-4">
		<div>
			<h2 class="font-semibold text-text-heading">{sku.skuCode}</h2>
			<p class="text-sm text-text-muted">
				NT$ {sku.price.toLocaleString('zh-TW')} · 庫存 {sku.stockQuantity.toLocaleString('zh-TW')}
			</p>
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
		</div>
	</header>
</section>
