<script lang="ts">
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import type { ManagedCategory } from '$lib/api/admin-api';
	import {
		buildCategoryTree,
		collectDescendantIds,
		createCategorySlug,
		flattenCategoryTree
	} from './category-tree';

	type Props = {
		open: boolean;
		category: ManagedCategory | null;
		categories: ManagedCategory[];
		defaultParentId: string | null;
		saving: boolean;
		onclose: () => void;
		onsave: (input: {
			name: string;
			nameEn?: string;
			slug: string;
			parentId?: string;
			description?: string;
			descriptionEn?: string;
			position: number;
		}) => Promise<void> | void;
	};

	let { open, category, categories, defaultParentId, saving, onclose, onsave }: Props = $props();

	let name = $state('');
	let nameEn = $state('');
	let slug = $state('');
	let parentId = $state('');
	let description = $state('');
	let descriptionEn = $state('');
	let position = $state('0');
	let slugTouched = $state(false);
	let errorMessage = $state('');
	let initializedKey = '';

	const title = $derived(category ? '編輯商品分類' : '新增商品分類');
	const parentOptions = $derived.by(() => {
		const tree = buildCategoryTree(categories);
		const current = category
			? (flattenCategoryTree(tree).find((entry) => entry.category.id === category.id)?.category ?? {
					...category,
					children: []
				})
			: null;
		const excludedIds = current ? collectDescendantIds(current) : new Set<string>();
		return flattenCategoryTree(tree).filter((entry) => !excludedIds.has(entry.category.id));
	});

	$effect(() => {
		const key = `${open}:${category?.id ?? 'new'}:${defaultParentId ?? ''}`;
		if (!open) {
			initializedKey = '';
			return;
		}
		if (key === initializedKey) return;
		initializedKey = key;
		name = category?.name ?? '';
		nameEn = category?.nameEn ?? '';
		slug = category?.slug ?? '';
		parentId = category?.parentId ?? defaultParentId ?? '';
		description = category?.description ?? '';
		descriptionEn = category?.descriptionEn ?? '';
		position = String(category?.position ?? 0);
		slugTouched = Boolean(category);
		errorMessage = '';
	});

	function updateEnglishName(value: string) {
		nameEn = value;
		if (!slugTouched) slug = createCategorySlug(value);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		const parsedPosition = Number(position);
		if (!name.trim() || !slug.trim()) {
			errorMessage = '請填寫分類名稱與網址代稱。';
			return;
		}
		if (!Number.isInteger(parsedPosition) || parsedPosition < 0) {
			errorMessage = '顯示順序必須是大於或等於 0 的整數。';
			return;
		}
		void onsave({
			name: name.trim(),
			...(nameEn.trim() ? { nameEn: nameEn.trim() } : {}),
			slug: slug.trim(),
			...(parentId ? { parentId } : {}),
			...(description.trim() ? { description: description.trim() } : {}),
			...(descriptionEn.trim() ? { descriptionEn: descriptionEn.trim() } : {}),
			position: parsedPosition
		});
	}
</script>

<Drawer
	{open}
	{title}
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

		<label class="block text-sm font-medium text-text-heading">
			分類名稱
			<input
				bind:value={name}
				required
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>

		<label class="block text-sm font-medium text-text-heading">
			英文名稱
			<input
				value={nameEn}
				oninput={(event) => updateEnglishName((event.currentTarget as HTMLInputElement).value)}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>

		<label class="block text-sm font-medium text-text-heading">
			網址代稱
			<input
				bind:value={slug}
				oninput={() => (slugTouched = true)}
				required
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>

		<label class="block text-sm font-medium text-text-heading">
			父分類
			<select
				bind:value={parentId}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			>
				<option value="">最上層</option>
				{#each parentOptions as option (option.category.id)}
					<option value={option.category.id}>
						{'　'.repeat(option.depth)}{option.category.name}
					</option>
				{/each}
			</select>
		</label>

		<label class="block text-sm font-medium text-text-heading">
			顯示順序
			<input
				bind:value={position}
				type="number"
				min="0"
				step="1"
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>

		<label class="block text-sm font-medium text-text-heading">
			中文描述
			<textarea
				bind:value={description}
				rows="4"
				class="mt-1 w-full rounded-md border border-border bg-bg-surface px-3 py-2"></textarea>
		</label>

		<label class="block text-sm font-medium text-text-heading">
			英文描述
			<textarea
				bind:value={descriptionEn}
				rows="4"
				class="mt-1 w-full rounded-md border border-border bg-bg-surface px-3 py-2"></textarea>
		</label>

		<button
			type="submit"
			disabled={saving}
			class="h-10 w-full cursor-pointer rounded-md bg-brand text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
		>
			{saving ? '儲存中…' : '儲存分類'}
		</button>
	</form>
</Drawer>
