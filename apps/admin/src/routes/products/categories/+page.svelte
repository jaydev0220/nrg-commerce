<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { PackagePlus } from '@lucide/svelte';

	import {
		AdminApiError,
		createCategory,
		deleteCategory,
		loadCategoryDetail,
		reorderCategories,
		updateCategory
	} from '$lib/api/admin-api';
	import CategoryDeleteDialog from '$lib/components/categories/CategoryDeleteDialog.svelte';
	import CategoryEditorDrawer from '$lib/components/categories/CategoryEditorDrawer.svelte';
	import CategoryTree from '$lib/components/categories/CategoryTree.svelte';
	import ProductSectionTabs from '$lib/components/products/ProductSectionTabs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let searchInput = $state('');
	let search = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let formError = $state('');
	let editorOpen = $state(false);
	let editorCategory = $state<PageData['categories'][number] | null>(null);
	let editorParentId = $state<string | null>(null);
	let editorSaving = $state(false);
	let deleteCategoryTarget = $state<PageData['categories'][number] | null>(null);
	let deleteDetail = $state<
		(PageData['categories'][number] & { children?: PageData['categories'] }) | null
	>(null);
	let deleteLoading = $state(false);
	let deleteBusy = $state(false);
	let reorderBusy = $state(false);

	const permissions = $derived(
		new Set(data.currentStaff?.roles.flatMap((role) => role.permissions) ?? [])
	);
	const canCreate = $derived(permissions.has('product.category.create'));
	const canUpdate = $derived(permissions.has('product.category.update'));
	const canDelete = $derived(permissions.has('product.category.delete'));

	function apiMessage(error: unknown, fallback: string): string {
		return error instanceof AdminApiError || error instanceof Error ? error.message : fallback;
	}

	function handleSearchInput(value: string) {
		searchInput = value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => (search = searchInput), 250);
	}

	function openCreate(parentId: string | null = null) {
		formError = '';
		editorCategory = null;
		editorParentId = parentId;
		editorOpen = true;
	}

	function openEdit(category: PageData['categories'][number]) {
		formError = '';
		editorCategory = category;
		editorParentId = category.parentId;
		editorOpen = true;
	}

	async function saveCategory(input: Parameters<typeof createCategory>[0]) {
		formError = '';
		editorSaving = true;
		try {
			if (editorCategory) {
				await updateCategory(editorCategory.id, {
					...input,
					nameEn: input.nameEn ?? null,
					parentId: input.parentId ?? null,
					description: input.description ?? null,
					descriptionEn: input.descriptionEn ?? null
				});
			} else {
				await createCategory(input);
			}
			editorOpen = false;
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法儲存商品分類。');
		} finally {
			editorSaving = false;
		}
	}

	async function openDelete(category: PageData['categories'][number]) {
		formError = '';
		deleteCategoryTarget = category;
		deleteDetail = null;
		deleteLoading = true;
		try {
			deleteDetail = await loadCategoryDetail(category.id);
		} catch (error) {
			formError = apiMessage(error, '無法取得分類使用情況。');
		} finally {
			deleteLoading = false;
		}
	}

	async function confirmDelete(input: Parameters<typeof deleteCategory>[1]) {
		if (!deleteCategoryTarget) return;
		formError = '';
		deleteBusy = true;
		try {
			await deleteCategory(deleteCategoryTarget.id, input);
			deleteCategoryTarget = null;
			deleteDetail = null;
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法刪除商品分類。');
		} finally {
			deleteBusy = false;
		}
	}

	async function persistReorder(parentId: string | null, categoryIds: string[]) {
		if (!canUpdate || reorderBusy || search.trim()) return;
		formError = '';
		reorderBusy = true;
		try {
			await reorderCategories({ parentId, categoryIds });
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法儲存分類順序。');
			await invalidateAll();
		} finally {
			reorderBusy = false;
		}
	}
</script>

<svelte:head><title>商品分類 | 管理後台</title></svelte:head>

<div class="space-y-5">
	<ProductSectionTabs active="categories" />
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-xl font-semibold text-text-heading">商品分類管理</h1>
		{#if canCreate}
			<button
				type="button"
				class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
				onclick={() => openCreate()}
			>
				<PackagePlus class="size-4" />新增分類
			</button>
		{/if}
	</header>

	{#if formError}
		<p
			class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
			role="alert"
		>
			{formError}
		</p>
	{/if}

	<section class="space-y-4">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<label class="block min-w-60 flex-1 text-sm font-medium text-text-heading">
				<input
					value={searchInput}
					oninput={(event) => handleSearchInput((event.currentTarget as HTMLInputElement).value)}
					placeholder="搜尋名稱或網址代稱"
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
				/>
			</label>
			<span class="text-xs text-text-muted">
				{reorderBusy ? '正在儲存順序…' : '可拖曳同層分類調整順序'}
			</span>
		</div>

		<CategoryTree
			categories={data.categories}
			{search}
			dragDisabled={!canUpdate || reorderBusy}
			oncreate={openCreate}
			onedit={canUpdate ? openEdit : () => undefined}
			ondelete={canDelete ? openDelete : () => undefined}
			onreorder={persistReorder}
		/>
	</section>
</div>

<CategoryEditorDrawer
	open={editorOpen}
	category={editorCategory}
	categories={data.categories}
	defaultParentId={editorParentId}
	saving={editorSaving}
	onclose={() => (editorOpen = false)}
	onsave={saveCategory}
/>

<CategoryDeleteDialog
	open={deleteCategoryTarget !== null}
	category={deleteCategoryTarget}
	detail={deleteDetail}
	categories={data.categories}
	loading={deleteLoading}
	busy={deleteBusy}
	onclose={() => {
		deleteCategoryTarget = null;
		deleteDetail = null;
	}}
	onconfirm={confirmDelete}
/>
