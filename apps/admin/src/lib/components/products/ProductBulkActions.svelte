<script lang="ts">
	import type { ProductBulkAction } from './types';

	let {
		count,
		archived,
		canUpdate,
		canDelete,
		busy,
		onaction
	}: {
		count: number;
		archived: boolean;
		canUpdate: boolean;
		canDelete: boolean;
		busy: boolean;
		onaction: (action: ProductBulkAction) => void;
	} = $props();
</script>

{#if count > 0}
	<div class="flex flex-wrap items-center gap-2 border-b border-border bg-bg-sunken px-4 py-3">
		<span class="mr-auto text-sm font-semibold text-text-heading">已選取 {count} 項</span>
		{#if archived}
			{#if canUpdate}
				<button
					type="button"
					aria-label="還原商品"
					class="h-9 cursor-pointer rounded-md border border-border px-3 text-sm font-semibold"
					disabled={busy}
					onclick={() => onaction('restore')}
				>
					還原商品
				</button>
			{/if}
		{:else}
			{#if canDelete}
				<button
					type="button"
					aria-label="封存商品"
					class="h-9 cursor-pointer rounded-md border border-border px-3 text-sm font-semibold"
					disabled={busy}
					onclick={() => onaction('archive')}
				>
					封存商品
				</button>
			{/if}
			{#if canUpdate}
				<button
					type="button"
					aria-label="上架商品"
					class="h-9 cursor-pointer rounded-md border border-border px-3 text-sm font-semibold"
					disabled={busy}
					onclick={() => onaction('publish')}
				>
					上架商品
				</button>
				<button
					type="button"
					aria-label="下架商品"
					class="h-9 cursor-pointer rounded-md border border-border px-3 text-sm font-semibold"
					disabled={busy}
					onclick={() => onaction('unpublish')}
				>
					下架商品
				</button>
			{/if}
		{/if}
	</div>
{/if}
