<script lang="ts">
	import ProductRow from './ProductRow.svelte';
	import type { ProductCategoryOption, ProductListItem } from './types';

	let {
		products,
		categoryOptions,
		selectedIds,
		allSelected,
		canUpdate,
		canDelete,
		expandedId,
		onselectall,
		onselect,
		onexpand,
		onarchive,
		onrestore,
		onquickcancel,
		onquicksave
	}: {
		products: ProductListItem[];
		categoryOptions: ProductCategoryOption[];
		selectedIds: string[];
		allSelected: boolean;
		canUpdate: boolean;
		canDelete: boolean;
		expandedId: string | null;
		onselectall: (checked: boolean) => void;
		onselect: (productId: string, checked: boolean) => void;
		onexpand: (productId: string) => void;
		onarchive: (productId: string) => void;
		onrestore: (productId: string) => void;
		onquickcancel: () => void;
		onquicksave: (event: SubmitEvent, productId: string) => void | Promise<void>;
	} = $props();

	const selectableProducts = $derived(
		products.filter((product) => (product.isDeleted ? canUpdate : canUpdate || canDelete))
	);
</script>

<div class="overflow-x-auto">
	<table class="w-full min-w-[920px] text-left text-sm">
		<thead class="border-b border-border bg-bg-sunken text-xs text-text-muted">
			<tr>
				<th class="w-12 px-4 py-3">
					<input
						type="checkbox"
						checked={allSelected}
						disabled={selectableProducts.length === 0}
						aria-label="選取全部商品"
						onchange={(event) => onselectall((event.currentTarget as HTMLInputElement).checked)}
					/>
				</th>
				<th class="px-4 py-3">商品</th>
				<th class="px-4 py-3">分類</th>
				<th class="px-4 py-3">狀態</th>
				<th class="px-4 py-3">SKU 數量</th>
				<th class="px-4 py-3">更新時間</th>
				<th class="px-4 py-3 text-right">操作</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-border">
			{#each products as product (product.id)}
				<ProductRow
					{product}
					{categoryOptions}
					selected={selectedIds.includes(product.id)}
					selectionDisabled={product.isDeleted ? !canUpdate : !(canUpdate || canDelete)}
					{canUpdate}
					{canDelete}
					expanded={expandedId === product.id}
					onselected={(checked) => onselect(product.id, checked)}
					ontoggle={() => onexpand(product.id)}
					onarchive={() => onarchive(product.id)}
					onrestore={() => onrestore(product.id)}
					{onquickcancel}
					onquicksave={(event) => onquicksave(event, product.id)}
				/>
			{/each}
		</tbody>
	</table>
</div>
