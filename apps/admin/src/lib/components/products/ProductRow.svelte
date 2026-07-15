<script lang="ts">
	import { ChevronDown, Edit3, Trash2, Undo2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	import Badge from '$lib/components/shared/Badge.svelte';
	import ProductQuickEditor from './ProductQuickEditor.svelte';
	import type { ProductCategoryOption, ProductListItem } from './types';

	let {
		product,
		categoryOptions,
		selected,
		selectionDisabled,
		canUpdate,
		canDelete,
		expanded,
		onselected,
		ontoggle,
		onarchive,
		onrestore,
		onquickcancel,
		onquicksave
	}: {
		product: ProductListItem;
		categoryOptions: ProductCategoryOption[];
		selected: boolean;
		selectionDisabled: boolean;
		canUpdate: boolean;
		canDelete: boolean;
		expanded: boolean;
		onselected: (checked: boolean) => void;
		ontoggle: () => void;
		onarchive: () => void;
		onrestore: () => void;
		onquickcancel: () => void;
		onquicksave: (event: SubmitEvent) => void | Promise<void>;
	} = $props();
</script>

<tr class="align-top">
	<td class="px-4 py-4">
		<input
			type="checkbox"
			checked={selected}
			aria-label={`選取商品 ${product.name}`}
			disabled={selectionDisabled}
			onchange={(event) => onselected((event.currentTarget as HTMLInputElement).checked)}
		/>
	</td>
	<td class="px-4 py-4">
		<strong class="block text-text-heading">{product.name}</strong>
		<span class="text-xs text-text-muted">{product.slug}</span>
	</td>
	<td class="px-4 py-4 text-text-muted">{product.categoryName}</td>
	<td class="px-4 py-4">
		<Badge tone={product.isDeleted ? 'warning' : product.published ? 'success' : 'neutral'}>
			{product.isDeleted ? '已封存' : product.published ? '已上架' : '未上架'}
		</Badge>
	</td>
	<td class="px-4 py-4">{product.skuCount}</td>
	<td class="px-4 py-4 text-text-muted">{product.updatedLabel}</td>
	<td class="px-4 py-4">
		<div class="flex justify-end gap-2">
			{#if canUpdate && !product.isDeleted}
				<button
					type="button"
					class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
					aria-label="展開快速編輯"
					title="展開快速編輯"
					onclick={ontoggle}
				>
					<ChevronDown class={expanded ? 'size-4 rotate-180' : 'size-4'} />
				</button>
				<a
					href={resolve(`/products/${product.id}`)}
					class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
					aria-label="編輯商品與圖片"
					title="編輯商品與圖片"
				>
					<Edit3 class="size-4" />
				</a>
			{/if}
			{#if product.isDeleted && canUpdate}
				<button
					type="button"
					class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
					aria-label="還原商品"
					title="還原商品"
					onclick={onrestore}
				>
					<Undo2 class="size-4" />
				</button>
			{:else if canDelete}
				<button
					type="button"
					class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border text-danger"
					aria-label="封存商品"
					title="封存商品"
					onclick={onarchive}
				>
					<Trash2 class="size-4" />
				</button>
			{/if}
		</div>
	</td>
</tr>
{#if expanded && canUpdate && !product.isDeleted}
	<tr class="bg-bg-sunken">
		<td
			colspan="7"
			class="px-4 py-4"
		>
			<ProductQuickEditor
				{product}
				{categoryOptions}
				oncancel={onquickcancel}
				onsave={onquicksave}
			/>
		</td>
	</tr>
{/if}
