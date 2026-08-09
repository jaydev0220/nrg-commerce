<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ArrowLeft, RotateCcw, Search, Trash2 } from '@lucide/svelte';

	import {
		AdminApiError,
		forceDeleteProductSku,
		restoreProductSku,
		type ManagedProductSku
	} from '$lib/api/admin-api';
	import ArchivedSkuRestoreDrawer from '$lib/components/products/ArchivedSkuRestoreDrawer.svelte';
	import type { ArchivedSkuRestoreInput } from '$lib/components/products/types';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import { createFilterHandlers } from '$lib/filter-navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let selected = $state<ManagedProductSku | null>(null);
	let message = $state('');
	let busySkuId = $state<string | null>(null);
	const filterHandlers = createFilterHandlers('/products/skus/archived');
	const permissions = $derived(
		new Set(data.currentStaff?.roles.flatMap((role) => role.permissions) ?? [])
	);
	const canRestore = $derived(permissions.has('product.sku.update'));
	const canDelete = $derived(permissions.has('product.sku.delete'));

	function errorMessage(error: unknown, fallback: string) {
		return error instanceof AdminApiError || error instanceof Error ? error.message : fallback;
	}

	async function restoreSku(skuId: string, input: ArchivedSkuRestoreInput) {
		message = '';
		await restoreProductSku(skuId, input);
		selected = null;
		message = '已還原 SKU。';
		await invalidateAll();
	}

	async function purgeSku(sku: ManagedProductSku) {
		if (sku.images.length > 0 || busySkuId) return;
		if (!confirm(`確定永久刪除 SKU「${sku.skuCode}」？此動作無法復原。`)) return;
		message = '';
		busySkuId = sku.id;
		try {
			await forceDeleteProductSku(sku.id);
			message = '已永久刪除 SKU。';
			await invalidateAll();
		} catch (error) {
			message = errorMessage(error, '無法永久刪除 SKU。');
		} finally {
			busySkuId = null;
		}
	}
</script>

<svelte:head><title>已封存 SKU | 管理後台</title></svelte:head>

<div class="space-y-5">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<a
				href={resolve('/products')}
				class="mb-2 inline-flex items-center gap-1 text-sm text-text-muted"
			>
				<ArrowLeft class="size-4" />返回商品管理
			</a>
			<h1 class="text-xl font-semibold text-text-heading">已封存 SKU</h1>
			<p class="text-sm text-text-muted">還原、重新指派或永久刪除已封存的 SKU</p>
		</div>
	</header>

	{#if message}<p
			class="rounded-md border border-border bg-bg-sunken p-3 text-sm"
			role="status"
		>
			{message}
		</p>{/if}

	<section class="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-xs">
		<form
			class="flex items-center gap-2 border-b border-border p-4"
			onsubmit={(event) => event.preventDefault()}
			oninput={filterHandlers.oninput}
			oncompositionstart={filterHandlers.oncompositionstart}
			oncompositionend={filterHandlers.oncompositionend}
		>
			<label class="relative min-w-0 flex-1">
				<Search class="pointer-events-none absolute top-3 left-3 size-4 text-text-muted" />
				<input
					name="search"
					value={page.url.searchParams.get('search') ?? ''}
					aria-label="搜尋已封存 SKU"
					placeholder="搜尋 SKU 代碼或商品名稱"
					class="h-10 w-full rounded-md border border-border bg-bg-surface pr-3 pl-9 text-sm"
				/>
			</label>
			<a
				href={resolve('/products/skus/archived')}
				class="inline-grid size-10 place-items-center rounded-md border border-border"
				aria-label="重設搜尋"
			>
				<RotateCcw class="size-4" />
			</a>
		</form>

		{#if data.skus.length === 0}
			<p class="p-8 text-center text-text-muted">沒有符合條件的已封存 SKU。</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full min-w-180 text-left text-sm">
					<thead class="bg-bg-sunken text-text-muted">
						<tr>
							<th class="px-4 py-3">SKU</th>
							<th class="px-4 py-3">原商品</th>
							<th class="px-4 py-3">價格</th>
							<th class="px-4 py-3">圖片</th>
							<th class="px-4 py-3 text-right">操作</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.skus as sku (sku.id)}
							<tr>
								<td class="px-4 py-4 font-medium text-text-heading">{sku.skuCode}</td>
								<td class="px-4 py-4">{sku.name}</td>
								<td class="px-4 py-4">NT$ {sku.price.toLocaleString('zh-TW')}</td>
								<td class="px-4 py-4">{sku.images.length}</td>
								<td class="px-4 py-4">
									<div class="flex justify-end gap-2">
										{#if canRestore}<button
												type="button"
												class="h-9 cursor-pointer rounded-md border border-border px-3"
												onclick={() => (selected = sku)}
											>
												還原
											</button>{/if}
										{#if canDelete}<button
												type="button"
												disabled={sku.images.length > 0 || busySkuId !== null}
												class="inline-grid size-9 cursor-pointer place-items-center rounded-md text-danger hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-40"
												aria-label={sku.images.length > 0
													? 'SKU 尚有圖片，無法永久刪除'
													: '永久刪除 SKU'}
												title={sku.images.length > 0 ? '請先移除 SKU 圖片' : '永久刪除 SKU'}
												onclick={() => void purgeSku(sku)}
											>
												<Trash2 class="size-4" />
											</button>{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		<Pagination pagination={data.pagination} />
	</section>
</div>

<ArchivedSkuRestoreDrawer
	sku={selected}
	products={data.products}
	onclose={() => (selected = null)}
	onrestore={restoreSku}
/>
