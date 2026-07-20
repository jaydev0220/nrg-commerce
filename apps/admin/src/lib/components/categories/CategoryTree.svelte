<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';

	import CategoryTreeBranch from './CategoryTreeBranch.svelte';
	import {
		buildCategoryTree,
		filterCategoryTree,
		type CategoryNode,
		replaceCategoryChildren
	} from './category-tree';
	import type { ManagedCategory } from '$lib/api/admin-api';

	type Props = {
		categories: ManagedCategory[];
		search: string;
		dragDisabled: boolean;
		oncreate: (parentId: string | null) => void;
		onedit: (category: ManagedCategory) => void;
		ondelete: (category: ManagedCategory) => void;
		onreorder: (parentId: string | null, categoryIds: string[]) => Promise<void> | void;
	};

	let { categories, search, dragDisabled, oncreate, onedit, ondelete, onreorder }: Props = $props();

	let tree = $state<CategoryNode[]>([]);
	let expandedIds = new SvelteSet<string>();
	let previousCategorySignature = '';
	let visibleTree = $derived(filterCategoryTree(tree, search));

	$effect(() => {
		const signature = categories
			.map((category) =>
				[
					category.id,
					category.parentId,
					category.position,
					category.name,
					category.nameEn,
					category.slug,
					category.updatedAt
				].join(':')
			)
			.join('|');
		if (signature === previousCategorySignature) return;
		previousCategorySignature = signature;
		tree = buildCategoryTree(categories);
		expandedIds.clear();
		for (const category of categories) {
			if (categories.some((child) => child.parentId === category.id)) {
				expandedIds.add(category.id);
			}
		}
	});

	function toggleExpanded(categoryId: string) {
		if (expandedIds.has(categoryId)) expandedIds.delete(categoryId);
		else expandedIds.add(categoryId);
	}

	function updateBranch(parentId: string | null, nodes: CategoryNode[]) {
		tree = replaceCategoryChildren(tree, parentId, nodes);
	}

	function handleConsider(parentId: string | null, nodes: CategoryNode[]) {
		updateBranch(parentId, nodes);
	}

	async function handleFinalize(parentId: string | null, nodes: CategoryNode[]) {
		updateBranch(parentId, nodes);
		await onreorder(
			parentId,
			nodes.map((node) => node.id)
		);
	}
</script>

<div class="overflow-hidden rounded-lg border border-border bg-bg-surface">
	<div
		class="grid grid-cols-[minmax(0,1fr)_minmax(8rem,0.55fr)_auto] gap-3 border-b border-border bg-bg-sunken px-4 py-3 text-xs font-semibold tracking-caps text-text-muted uppercase"
		role="row"
	>
		<span>分類</span>
		<span>英文名稱</span>
		<span class="sr-only">操作</span>
	</div>

	{#if visibleTree.length > 0}
		<div
			role="treegrid"
			aria-label="商品分類清單"
		>
			<CategoryTreeBranch
				nodes={visibleTree}
				parentId={null}
				depth={0}
				{expandedIds}
				dragDisabled={dragDisabled || Boolean(search.trim())}
				onconsider={handleConsider}
				onfinalize={handleFinalize}
				ontoggle={toggleExpanded}
				{oncreate}
				{onedit}
				{ondelete}
			/>
		</div>
	{:else}
		<div class="grid min-h-40 place-items-center px-4 py-10 text-center text-sm text-text-muted">
			尚無符合條件的商品分類。
		</div>
	{/if}
</div>
