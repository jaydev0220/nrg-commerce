<script lang="ts">
	import { Edit3, MoreHorizontal, PackagePlus, RotateCcw, Search } from '@lucide/svelte';

	import Badge from '$lib/components/Badge.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const statusOptions = [
		{ label: '全部狀態', value: 'all' },
		{ label: '已上架', value: 'published' },
		{ label: '草稿', value: 'draft' }
	] as const;

	let search = $state('');
	let status = $state<(typeof statusOptions)[number]['value']>('all');
	let categoryId = $state('all');
	let selectedProductIds = $state<string[]>([]);

	const filteredProducts = $derived.by(() => {
		const query = search.trim().toLowerCase();

		return data.products.filter((product) => {
			const matchesSearch =
				!query ||
				[product.name, product.slug, ...product.skuCodes].join(' ').toLowerCase().includes(query);
			const matchesStatus =
				status === 'all' || (status === 'published' ? product.published : !product.published);
			const matchesCategory = categoryId === 'all' || product.categoryId === categoryId;

			return matchesSearch && matchesStatus && matchesCategory;
		});
	});

	const allVisibleSelected = $derived(
		filteredProducts.length > 0 &&
			filteredProducts.every((product) => selectedProductIds.includes(product.id))
	);

	function resetFilters() {
		search = '';
		status = 'all';
		categoryId = 'all';
	}

	function toggleProductSelection(productId: string, checked: boolean) {
		if (checked) {
			selectedProductIds = selectedProductIds.includes(productId)
				? selectedProductIds
				: [...selectedProductIds, productId];
			return;
		}

		selectedProductIds = selectedProductIds.filter((selectedId) => selectedId !== productId);
	}

	function toggleVisibleSelection(checked: boolean) {
		const visibleIds = filteredProducts.map((product) => product.id);

		if (checked) {
			selectedProductIds = Array.from(new Set([...selectedProductIds, ...visibleIds]));
			return;
		}

		selectedProductIds = selectedProductIds.filter((productId) => !visibleIds.includes(productId));
	}
</script>

<svelte:head>
	<title>商品 | 管理後台</title>
</svelte:head>

<div class="space-y-5">
	<div class="flex flex-col gap-3 sm:flex-wrap sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h2 class="text-xl font-semibold tracking-normal text-text-heading">商品管理</h2>
		</div>
		<button
			type="button"
			disabled
			class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent opacity-55"
		>
			<PackagePlus class="size-4" />
			新增商品
		</button>
	</div>

	<section
		class="grid gap-3 sm:grid-cols-3"
		aria-label="商品摘要"
	>
		{#each data.summary as item (item.label)}
			<article class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
				<span class="text-sm font-medium text-text-muted">{item.label}</span>
				<strong class="mt-2 block text-2xl text-text-heading">{item.value}</strong>
			</article>
		{/each}
	</section>

	<section
		class="rounded-lg border border-border bg-bg-surface shadow-xs"
		aria-labelledby="product-list"
	>
		<div class="flex flex-col gap-3 border-b border-border p-4 2xl:flex-row 2xl:items-center">
			<h2
				id="product-list"
				class="text-lg font-semibold tracking-normal text-text-heading"
			>
				商品列表
			</h2>
			<div class="flex min-w-0 flex-1 flex-wrap gap-2">
				<label class="relative block min-w-[16rem] flex-1 basis-[18rem]">
					<Search
						class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
					/>
					<input
						bind:value={search}
						type="search"
						placeholder="搜尋商品名稱或 SKU"
						class="h-10 w-full rounded-md border border-border bg-bg-surface pl-9 pr-3 text-sm text-text-body placeholder:text-text-subtle"
					/>
				</label>

				<label class="min-w-44 flex-1 basis-44 sm:flex-none sm:w-44">
					<select
						bind:value={status}
						class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
					>
						{#each statusOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<label class="min-w-44 flex-1 basis-44 sm:flex-none sm:w-44">
					<select
						bind:value={categoryId}
						class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
					>
						<option value="all">全部分類</option>
						{#each data.categoryOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<button
					type="button"
					class="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-bg-surface px-3 text-sm font-semibold text-text-body hover:bg-bg-sunken"
					onclick={resetFilters}
				>
					<RotateCcw class="size-4" />
					重設
				</button>
			</div>
		</div>

		<div class="hidden xl:block">
			<table class="w-full text-left text-sm">
				<thead
					class="border-b border-border bg-bg-sunken text-xs uppercase tracking-caps text-text-muted"
				>
					<tr>
						<th class="w-12 px-4 py-3">
							<label class="inline-flex items-center">
								<input
									type="checkbox"
									checked={allVisibleSelected}
									onchange={(event) =>
										toggleVisibleSelection((event.currentTarget as HTMLInputElement).checked)}
									class="size-4 rounded border-border text-brand"
									aria-label="選取所有可見商品"
								/>
							</label>
						</th>
						<th class="px-4 py-3">商品</th>
						<th class="px-4 py-3">分類</th>
						<th class="px-4 py-3">狀態</th>
						<th class="px-4 py-3">價格</th>
						<th class="px-4 py-3">SKU 數</th>
						<th class="px-4 py-3">更新日期</th>
						<th class="px-4 py-3 text-right">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each filteredProducts as product (product.id)}
						<tr>
							<td class="px-4 py-4">
								<label class="inline-flex items-center">
									<input
										type="checkbox"
										checked={selectedProductIds.includes(product.id)}
										onchange={(event) =>
											toggleProductSelection(
												product.id,
												(event.currentTarget as HTMLInputElement).checked
											)}
										class="size-4 rounded border-border text-brand"
										aria-label={`選取 ${product.name}`}
									/>
								</label>
							</td>
							<td class="px-4 py-4">
								<strong class="block text-text-heading">{product.name}</strong>
								<span class="text-xs text-text-muted">{product.skuCodes.join(', ')}</span>
							</td>
							<td class="px-4 py-4 text-text-muted">{product.categoryName}</td>
							<td class="px-4 py-4">
								<Badge tone={product.published ? 'success' : 'neutral'}>
									{product.published ? '已上架' : '草稿'}
								</Badge>
							</td>
							<td class="px-4 py-4 font-medium text-text-heading">{product.priceRange}</td>
							<td class="px-4 py-4 text-text-muted">{product.skuCount}</td>
							<td class="px-4 py-4 text-text-muted">{product.updatedAt}</td>
							<td class="px-4 py-4">
								<div class="flex justify-end gap-2">
									<button
										type="button"
										disabled
										class="inline-grid size-9 place-items-center rounded-md border border-border text-text-muted opacity-55"
										aria-label={`編輯 ${product.name}`}
									>
										<Edit3 class="size-4" />
									</button>
									<button
										type="button"
										disabled
										class="inline-grid size-9 place-items-center rounded-md border border-border text-text-muted opacity-55"
										aria-label={`${product.name} 的更多操作`}
									>
										<MoreHorizontal class="size-4" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="grid gap-3 p-4 xl:hidden">
			{#each filteredProducts as product (product.id)}
				<article class="rounded-lg border border-border bg-bg-surface p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="flex min-w-0 items-start gap-3">
							<label class="pt-0.5">
								<input
									type="checkbox"
									checked={selectedProductIds.includes(product.id)}
									onchange={(event) =>
										toggleProductSelection(
											product.id,
											(event.currentTarget as HTMLInputElement).checked
										)}
									class="size-4 rounded border-border text-brand"
									aria-label={`選取 ${product.name}`}
								/>
							</label>
							<div class="min-w-0">
								<strong class="block text-text-heading">{product.name}</strong>
								<span class="text-xs text-text-muted">{product.skuCodes.join(', ')}</span>
							</div>
						</div>
						<Badge tone={product.published ? 'success' : 'neutral'}>
							{product.published ? '已上架' : '草稿'}
						</Badge>
					</div>
					<div class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
						<div>
							<span class="block text-text-muted">分類</span>
							<strong class="block text-text-heading">{product.categoryName}</strong>
						</div>
						<div>
							<span class="block text-text-muted">價格</span>
							<strong class="block text-text-heading">{product.priceRange}</strong>
						</div>
						<div>
							<span class="block text-text-muted">SKU 數</span>
							<strong class="block text-text-heading">{product.skuCount}</strong>
						</div>
						<div>
							<span class="block text-text-muted">更新日期</span>
							<strong class="block text-text-heading">{product.updatedAt}</strong>
						</div>
					</div>
				</article>
			{/each}
		</div>

		<div class="border-t border-border px-4 py-3 text-sm text-text-muted">
			顯示 {filteredProducts.length} / {data.products.length} 項商品
		</div>
	</section>
</div>
