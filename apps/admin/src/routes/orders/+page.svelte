<script lang="ts">
	import { CirclePlus, RotateCcw, Search, ShoppingCart, Trash2 } from '@lucide/svelte';

	import Badge from '$lib/components/Badge.svelte';
	import { localizeAdminLabel } from '$lib/labels';
	import type { ActionData, PageData } from './$types';

	type OrderFilter = 'all' | PageData['orders'][number]['status'];

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let search = $state('');
	let status = $state<OrderFilter>('all');
	let lineItemIndex = $state(2);
	let lineItems = $state([{ id: 1 }, { id: 2 }]);

	const filteredOrders = $derived.by(() => {
		const query = search.trim().toLowerCase();

		return data.orders.filter((order) => {
			const matchesSearch =
				!query ||
				[
					order.id,
					order.businessName,
					order.customerName,
					order.customerEmail ?? '',
					...order.items.map((item) => item.skuCode),
					...order.items.map((item) => item.productName)
				]
					.join(' ')
					.toLowerCase()
					.includes(query);
			const matchesStatus = status === 'all' || order.status === status;

			return matchesSearch && matchesStatus;
		});
	});

	function resetFilters() {
		search = '';
		status = 'all';
	}

	function addLineItem() {
		lineItemIndex += 1;
		lineItems = [...lineItems, { id: lineItemIndex }];
	}

	function removeLineItem(lineItemId: number) {
		if (lineItems.length === 1) {
			return;
		}

		lineItems = lineItems.filter((lineItem) => lineItem.id !== lineItemId);
	}

	function levelTone(orderStatus: string): 'accent' | 'neutral' | 'warning' | 'danger' | 'success' {
		if (orderStatus === 'completed') return 'success';
		if (orderStatus === 'cancelled' || orderStatus === 'refunded') return 'danger';
		if (orderStatus === 'processing') return 'warning';
		if (orderStatus === 'confirmed') return 'accent';
		return 'neutral';
	}
</script>

<svelte:head>
	<title>訂單 | 管理後台</title>
</svelte:head>

<div class="space-y-5">
	<div class="flex flex-col gap-3 sm:flex-wrap sm:flex-row sm:items-center sm:justify-between">
		<h2 class="text-xl font-semibold tracking-normal text-text-heading">訂單管理</h2>
	</div>

	<section
		class="grid gap-3 sm:grid-cols-3"
		aria-label="訂單摘要"
	>
		{#each data.summary as item (item.label)}
			<article class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
				<span class="text-sm font-medium text-text-muted">{item.label}</span>
				<strong class="mt-2 block text-2xl text-text-heading">{item.value}</strong>
			</article>
		{/each}
	</section>

	<section class="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,24rem)]">
		<article class="rounded-lg border border-border bg-bg-surface shadow-xs">
			<div class="flex flex-col gap-3 border-b border-border p-4 2xl:flex-row 2xl:items-center">
				<h2 class="text-lg font-semibold tracking-normal text-text-heading">訂單列表</h2>
				<div class="flex min-w-0 flex-1 flex-wrap gap-2">
					<label class="relative block min-w-[16rem] flex-1 basis-[18rem]">
						<Search
							class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
						/>
						<input
							bind:value={search}
							type="search"
							class="h-10 w-full rounded-md border border-border bg-bg-surface pl-9 pr-3 text-sm text-text-body"
							placeholder="搜尋訂單、企業或品項"
						/>
					</label>

					<label class="min-w-44 flex-1 basis-44 sm:flex-none sm:w-44">
						<select
							bind:value={status}
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						>
							<option value="all">全部狀態</option>
							{#each data.statusOptions as option (option.value)}
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

			<div class="grid gap-3 p-4">
				{#each filteredOrders as order (order.id)}
					<article class="rounded-lg border border-border bg-bg-surface p-4">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<strong class="text-text-heading">#{order.id.slice(0, 8)}</strong>
									<Badge tone={levelTone(order.status)}>
										{localizeAdminLabel(order.status)}
									</Badge>
								</div>
								<div class="mt-2 grid gap-2 text-sm text-text-muted sm:grid-cols-2">
									<span>{order.businessName}</span>
									<span>{order.customerName}</span>
									<span>{order.customerEmail ?? '未填寫電子郵件'}</span>
									<span>{order.createdAt}</span>
								</div>
								<ul class="mt-3 space-y-2 text-sm text-text-body">
									{#each order.items as item (item.id)}
										<li class="rounded-md border border-border bg-bg-sunken px-3 py-2">
											<div class="flex flex-wrap items-center justify-between gap-2">
												<span class="font-medium">{item.productName}</span>
												<span class="text-text-muted">
													{item.skuCode} · {item.quantity} 件 · {item.lineTotal}
												</span>
											</div>
										</li>
									{/each}
								</ul>
							</div>

							<div class="min-w-0 rounded-lg border border-border bg-bg-sunken p-3 lg:w-64">
								<div class="mb-2 text-sm font-medium text-text-heading">更新狀態</div>
								<form
									method="POST"
									action="?/updateStatus"
									class="flex flex-wrap gap-2"
								>
									<input
										type="hidden"
										name="orderId"
										value={order.id}
									/>
									<select
										name="status"
										class="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
									>
										{#each data.statusOptions as option (option.value)}
											<option
												value={option.value}
												selected={option.value === order.status}
											>
												{option.label}
											</option>
										{/each}
									</select>
									<button
										type="submit"
										class="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
									>
										更新
									</button>
								</form>
								<div class="mt-3 text-sm text-text-muted">
									總計 {order.totalAmount} · {order.itemCount} 件
								</div>
							</div>
						</div>
					</article>
				{/each}
			</div>

			<div class="border-t border-border px-4 py-3 text-sm text-text-muted">
				顯示 {filteredOrders.length} / {data.orders.length} 筆訂單
			</div>
		</article>

		<section class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
			<div class="mb-4 flex items-center gap-2">
				<ShoppingCart class="size-5 text-brand" />
				<h2 class="text-lg font-semibold tracking-normal text-text-heading">建立訂單</h2>
			</div>

			<form
				method="POST"
				action="?/create"
				class="space-y-4"
			>
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-text-heading">企業客戶</span>
					<select
						name="businessId"
						class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
					>
						{#each data.businessOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<div class="grid gap-3 sm:grid-cols-2">
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">顧客名稱</span>
						<input
							name="customerName"
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">電子郵件</span>
						<input
							name="customerEmail"
							type="email"
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">電話</span>
						<input
							name="customerPhone"
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						/>
					</label>
					<label class="block sm:col-span-2">
						<span class="mb-1 block text-sm font-medium text-text-heading">地址</span>
						<textarea
							name="customerAddress"
							rows="2"
							class="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-body"></textarea>
					</label>
				</div>

				<div class="space-y-3">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-sm font-semibold text-text-heading">訂單項目</h3>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-text-body hover:bg-bg-sunken"
							onclick={addLineItem}
						>
							<CirclePlus class="size-4" />
							新增項目
						</button>
					</div>

					{#each lineItems as lineItem, index (lineItem.id)}
						<div class="rounded-lg border border-border bg-bg-sunken p-3">
							<div class="mb-3 flex items-center justify-between gap-3">
								<strong class="text-sm text-text-heading">項目 {index + 1}</strong>
								<button
									type="button"
									class="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border px-2 text-sm font-semibold text-text-body hover:bg-bg-surface disabled:opacity-50"
									onclick={() => removeLineItem(lineItem.id)}
									disabled={lineItems.length === 1}
								>
									<Trash2 class="size-4" />
								</button>
							</div>

							<div class="grid gap-3">
								<label class="block">
									<span class="mb-1 block text-sm font-medium text-text-heading">SKU ID</span>
									<input
										name="itemProductSkuId"
										class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
									/>
								</label>
								<div class="grid gap-3 sm:grid-cols-2">
									<label class="block">
										<span class="mb-1 block text-sm font-medium text-text-heading">SKU 代碼</span>
										<input
											name="itemSkuCode"
											required={index === 0}
											class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
										/>
									</label>
									<label class="block">
										<span class="mb-1 block text-sm font-medium text-text-heading">品項名稱</span>
										<input
											name="itemProductName"
											required={index === 0}
											class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
										/>
									</label>
									<label class="block">
										<span class="mb-1 block text-sm font-medium text-text-heading">單價</span>
										<input
											name="itemUnitPrice"
											type="number"
											step="0.01"
											min="0"
											required={index === 0}
											class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
										/>
									</label>
									<label class="block">
										<span class="mb-1 block text-sm font-medium text-text-heading">數量</span>
										<input
											name="itemQuantity"
											type="number"
											step="1"
											min="1"
											value="1"
											required={index === 0}
											class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
										/>
									</label>
								</div>
								<label class="block">
									<span class="mb-1 block text-sm font-medium text-text-heading">屬性 JSON</span>
									<textarea
										name="itemAttributes"
										rows="2"
										class="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-body"
										placeholder="例如 color=black 的 JSON 物件"></textarea>
								</label>
							</div>
						</div>
					{/each}
				</div>

				{#if form?.createError}
					<p class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
						{form.createError}
					</p>
				{/if}
				{#if form?.createSuccess}
					<p
						class="rounded-md border border-success/20 bg-success-bg px-3 py-2 text-sm text-success"
					>
						{form.createSuccess}
					</p>
				{/if}
				{#if form?.statusError}
					<p class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
						{form.statusError}
					</p>
				{/if}
				{#if form?.statusSuccess}
					<p
						class="rounded-md border border-success/20 bg-success-bg px-3 py-2 text-sm text-success"
					>
						{form.statusSuccess}
					</p>
				{/if}

				<button
					type="submit"
					class="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
				>
					建立訂單
				</button>
			</form>
		</section>
	</section>
</div>
