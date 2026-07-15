<script lang="ts">
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { PackagePlus } from '@lucide/svelte';
	import { page } from '$app/state';

	import {
		AdminApiError,
		bulkUpdateProducts,
		createProduct,
		updateProduct
	} from '$lib/api/admin-api';
	import ProductBulkActions from '$lib/components/products/ProductBulkActions.svelte';
	import ProductCreateDrawer from '$lib/components/products/ProductCreateDrawer.svelte';
	import ProductFilters from '$lib/components/products/ProductFilters.svelte';
	import ProductTable from '$lib/components/products/ProductTable.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import type { ProductBulkAction, ProductCreateInput } from '$lib/components/products/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let formError = $state('');
	let createOpen = $state(false);
	let expandedId = $state<string | null>(null);
	let selectedIds = $state<string[]>([]);
	let bulkBusy = $state(false);

	afterNavigate(() => {
		selectedIds = [];
		expandedId = null;
	});

	const permissions = $derived(
		new Set(data.currentStaff?.roles.flatMap((role) => role.permissions) ?? [])
	);
	const canCreate = $derived(permissions.has('product.create'));
	const canUpdate = $derived(permissions.has('product.update'));
	const canDelete = $derived(permissions.has('product.delete'));
	const selectableProducts = $derived(
		data.products.filter((product) => (product.isDeleted ? canUpdate : canUpdate || canDelete))
	);
	const allSelected = $derived(
		selectableProducts.length > 0 &&
			selectableProducts.every((product) => selectedIds.includes(product.id))
	);
	const archived = $derived(page.url.searchParams.get('archived') === 'true');

	function apiMessage(error: unknown, fallback: string): string {
		return error instanceof AdminApiError || error instanceof Error ? error.message : fallback;
	}

	function toggleSelected(productId: string, checked: boolean) {
		selectedIds = checked
			? [...new Set([...selectedIds, productId])]
			: selectedIds.filter((id) => id !== productId);
	}

	function toggleAll(checked: boolean) {
		selectedIds = checked ? selectableProducts.map((product) => product.id) : [];
	}

	async function saveQuickEdit(event: SubmitEvent, productId: string) {
		event.preventDefault();
		formError = '';
		const values = new FormData(event.currentTarget as HTMLFormElement);
		try {
			await updateProduct(productId, {
				name: String(values.get('name') ?? '').trim(),
				slug: String(values.get('slug') ?? '').trim(),
				categoryId: String(values.get('categoryId') ?? '').trim() || null,
				published: values.get('published') === 'on'
			});
			expandedId = null;
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法更新商品。');
		}
	}

	async function createNewProduct(input: ProductCreateInput) {
		await createProduct(input);
		await invalidateAll();
	}

	async function productAction(action: ProductBulkAction, productId: string) {
		selectedIds = [productId];
		await bulkAction(action);
	}

	async function bulkAction(action: ProductBulkAction) {
		if (selectedIds.length === 0 || bulkBusy) return;
		formError = '';
		bulkBusy = true;
		try {
			await bulkUpdateProducts({ productIds: selectedIds, action });
			selectedIds = [];
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '批次更新商品時發生錯誤。');
		} finally {
			bulkBusy = false;
		}
	}
</script>

<svelte:head><title>商品 | 管理後台</title></svelte:head>

<div class="space-y-5">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-xl font-semibold text-text-heading">商品管理</h1>
		{#if canCreate}
			<button
				type="button"
				class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
				onclick={() => (createOpen = true)}
			>
				<PackagePlus class="size-4" />新增商品
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

	<section class="rounded-lg border border-border bg-bg-surface shadow-xs">
		<ProductFilters />
		<ProductBulkActions
			count={selectedIds.length}
			{archived}
			{canUpdate}
			{canDelete}
			busy={bulkBusy}
			onaction={(action) => void bulkAction(action)}
		/>
		<ProductTable
			products={data.products}
			categoryOptions={data.categoryOptions}
			{selectedIds}
			{allSelected}
			{canUpdate}
			{canDelete}
			{expandedId}
			onselectall={toggleAll}
			onselect={toggleSelected}
			onexpand={(productId) => (expandedId = expandedId === productId ? null : productId)}
			onarchive={(productId) => void productAction('archive', productId)}
			onrestore={(productId) => void productAction('restore', productId)}
			onquickcancel={() => (expandedId = null)}
			onquicksave={saveQuickEdit}
		/>
		<Pagination pagination={data.pagination} />
	</section>
</div>

<ProductCreateDrawer
	open={createOpen}
	categoryOptions={data.categoryOptions}
	onclose={() => (createOpen = false)}
	oncreate={createNewProduct}
/>
