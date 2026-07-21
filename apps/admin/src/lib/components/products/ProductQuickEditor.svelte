<script lang="ts">
	import type { ProductCategoryOption, ProductListItem } from './types';

	let {
		product,
		categoryOptions,
		oncancel,
		onsave
	}: {
		product: ProductListItem;
		categoryOptions: ProductCategoryOption[];
		oncancel: () => void;
		onsave: (event: SubmitEvent) => void | Promise<void>;
	} = $props();
</script>

<form
	class="grid gap-3 md:grid-cols-2"
	onsubmit={(event) => void onsave(event)}
>
	<label class="text-sm font-medium">
		商品名稱
		<input
			required
			name="name"
			value={product.name}
			class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
		/>
	</label>
	<label class="text-sm font-medium">
		網址代稱
		<input
			required
			name="slug"
			value={product.slug}
			class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
		/>
	</label>
	<label class="text-sm font-medium">
		分類
		<select
			name="categoryId"
			value={product.categoryId ?? ''}
			class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
		>
			{#each categoryOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	<label class="flex items-center gap-2 self-end text-sm font-medium">
		<input
			type="checkbox"
			name="published"
			checked={product.published}
			class="size-4"
		/>
		上架商品
	</label>
	<div class="flex justify-end gap-2 md:col-span-2">
		<button
			type="button"
			class="h-10 cursor-pointer rounded-md border border-border px-4 text-sm"
			onclick={oncancel}
		>
			取消
		</button>
		<button
			type="submit"
			class="h-10 cursor-pointer rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
		>
			儲存變更
		</button>
	</div>
</form>
