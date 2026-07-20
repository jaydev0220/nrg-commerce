<script lang="ts">
	import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { dragHandle, dragHandleZone } from 'svelte-dnd-action';

	import type { CategoryNode } from './category-tree';
	import Self from './CategoryTreeBranch.svelte';

	type Props = {
		nodes: CategoryNode[];
		parentId: string | null;
		depth: number;
		expandedIds: Set<string>;
		dragDisabled: boolean;
		onconsider: (parentId: string | null, nodes: CategoryNode[]) => void;
		onfinalize: (parentId: string | null, nodes: CategoryNode[]) => void;
		ontoggle: (categoryId: string) => void;
		oncreate: (parentId: string) => void;
		onedit: (category: CategoryNode) => void;
		ondelete: (category: CategoryNode) => void;
	};

	let {
		nodes,
		parentId,
		depth,
		expandedIds,
		dragDisabled,
		onconsider,
		onfinalize,
		ontoggle,
		oncreate,
		onedit,
		ondelete
	}: Props = $props();

	type DndItems = { items: CategoryNode[] };

	function handleConsider(event: CustomEvent<DndItems>) {
		onconsider(parentId, event.detail.items);
	}

	function handleFinalize(event: CustomEvent<DndItems>) {
		onfinalize(parentId, event.detail.items);
	}
</script>

<div
	class="divide-y divide-border"
	role="rowgroup"
	use:dragHandleZone={{ items: nodes, type: 'product-category', dragDisabled, flipDurationMs: 150 }}
	onconsider={handleConsider}
	onfinalize={handleFinalize}
>
	{#each nodes as category (category.id)}
		<div
			role="row"
			class="group bg-bg-surface transition-colors hover:bg-bg-sunken"
		>
			<div
				class="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(8rem,0.55fr)_auto] items-center gap-3 px-4 py-2"
				style={`padding-left: ${0.75 + depth * 1.25}rem`}
			>
				<div class="flex min-w-0 items-center gap-2">
					{#if category.children.length > 0}
						<button
							type="button"
							class="inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-text-muted hover:bg-bg-accent hover:text-text-heading"
							aria-label={expandedIds.has(category.id) ? '收合分類' : '展開分類'}
							title={expandedIds.has(category.id) ? '收合分類' : '展開分類'}
							onclick={() => ontoggle(category.id)}
						>
							{#if expandedIds.has(category.id)}
								<ChevronDown class="size-4" />
							{:else}
								<ChevronRight class="size-4" />
							{/if}
						</button>
					{:else}
						<span
							class="size-8 shrink-0"
							aria-hidden="true"
						></span>
					{/if}
					{#if !dragDisabled}
						<span
							class="inline-grid size-8 shrink-0 cursor-grab place-items-center rounded-md text-text-muted active:cursor-grabbing"
							use:dragHandle
							aria-label="拖曳以調整順序"
							title="拖曳以調整順序"
						>
							<GripVertical class="size-4" />
						</span>
					{/if}
					<div class="min-w-0">
						<strong class="block truncate text-sm font-semibold text-text-heading">
							{category.name}
						</strong>
						<span class="block truncate text-xs text-text-muted">{category.slug}</span>
					</div>
				</div>

				<div class="min-w-0 truncate text-sm text-text-muted">
					{category.nameEn || '未設定英文名稱'}
				</div>

				<div
					class="flex items-center justify-end gap-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
				>
					<button
						type="button"
						class="inline-grid size-8 cursor-pointer place-items-center rounded-md text-text-muted hover:bg-bg-accent hover:text-text-accent"
						aria-label={`在${category.name}下新增分類`}
						title="新增子分類"
						onclick={() => oncreate(category.id)}
					>
						<Plus class="size-4" />
					</button>
					<button
						type="button"
						class="inline-grid size-8 cursor-pointer place-items-center rounded-md text-text-muted hover:bg-bg-accent hover:text-text-accent"
						aria-label={`編輯${category.name}`}
						title="編輯分類"
						onclick={() => onedit(category)}
					>
						<Pencil class="size-4" />
					</button>
					<button
						type="button"
						class="inline-grid size-8 cursor-pointer place-items-center rounded-md text-text-muted hover:bg-danger-bg hover:text-danger"
						aria-label={`刪除${category.name}`}
						title="刪除分類"
						onclick={() => ondelete(category)}
					>
						<Trash2 class="size-4" />
					</button>
				</div>
			</div>

			{#if expandedIds.has(category.id) && category.children.length > 0}
				<Self
					nodes={category.children}
					parentId={category.id}
					depth={depth + 1}
					{expandedIds}
					{dragDisabled}
					{onconsider}
					{onfinalize}
					{ontoggle}
					{oncreate}
					{onedit}
					{ondelete}
				/>
			{/if}
		</div>
	{/each}
</div>
