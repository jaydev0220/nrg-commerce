<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Edit3, RotateCcw, Search, ShoppingCart } from '@lucide/svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	import {
		AdminApiError,
		createOrder,
		formatDateTime,
		updateOrder,
		type OrderInput
	} from '$lib/api/admin-api';
	import OrderCreateDrawer from '$lib/components/orders/OrderCreateDrawer.svelte';
	import OrderDetailDrawer from '$lib/components/orders/OrderDetailDrawer.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import { applyFilters, scheduleFilters } from '$lib/filter-navigation';
	import { localizeAdminLabel } from '$lib/labels';
	import { validateOrderCustomerContact } from '$lib/order-validation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let formError = $state('');
	let createOpen = $state(false);
	let selected = $state<PageData['orders'][number] | null>(null);
	let editBusinessId = $state('');

	const permissions = $derived(
		new Set(data.currentStaff?.roles.flatMap((role) => role.permissions) ?? [])
	);
	const canWrite = $derived(permissions.has('order.write'));

	function openCreate() {
		formError = '';
		createOpen = true;
	}

	function openEdit(order: PageData['orders'][number]) {
		formError = '';
		editBusinessId = order.businessId ?? '';
		selected = order;
	}

	function tone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
		return status === 'completed'
			? 'success'
			: status === 'cancelled' || status === 'refunded'
				? 'danger'
				: status === 'processing'
					? 'warning'
					: 'neutral';
	}

	function optional(value: FormDataEntryValue | null): string | null {
		const normalized = String(value ?? '').trim();
		return normalized || null;
	}

	function apiMessage(error: unknown, fallback: string): string {
		return error instanceof AdminApiError || error instanceof Error ? error.message : fallback;
	}

	async function submitCreate(input: OrderInput, requestKey: string) {
		try {
			await createOrder(input, requestKey);
			createOpen = false;
			await invalidateAll();
		} catch (error) {
			throw new Error(apiMessage(error, '無法建立訂單。'), { cause: error });
		}
	}

	async function submitUpdate(event: SubmitEvent) {
		event.preventDefault();
		if (!selected) return;
		formError = '';
		const values = new FormData(event.currentTarget as HTMLFormElement);
		try {
			const businessId = optional(values.get('businessId'));
			const customerName = optional(values.get('customerName'));
			const customerPhone = optional(values.get('customerPhone'));
			const contactError = validateOrderCustomerContact({
				businessId,
				customerName,
				customerPhone
			});
			if (contactError) throw new Error(contactError);
			await updateOrder(selected.id, {
				status: String(values.get('status')) as PageData['orders'][number]['status'],
				businessId,
				customerName,
				customerEmail: optional(values.get('customerEmail')),
				customerPhone,
				customerAddress: optional(values.get('customerAddress'))
			});
			selected = null;
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法更新訂單。');
		}
	}
</script>

<svelte:head><title>訂單 | 管理後台</title></svelte:head>

<div class="space-y-5">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-xl font-semibold text-text-heading">訂單管理</h1>
		{#if canWrite}
			<button
				type="button"
				class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
				onclick={openCreate}
			>
				<ShoppingCart class="size-4" />建立訂單
			</button>
		{/if}
	</header>
	{#if formError}<p
			class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
			role="alert"
		>
			{formError}
		</p>{/if}

	<section class="rounded-lg border border-border bg-bg-surface shadow-xs">
		<form
			class="flex flex-wrap items-center gap-2 border-b border-border p-4"
			onsubmit={(event) => event.preventDefault()}
			oninput={(event) => scheduleFilters('/orders', event.currentTarget as HTMLFormElement)}
			onchange={(event) => applyFilters('/orders', event.currentTarget as HTMLFormElement)}
		>
			<label class="relative min-w-0 flex-[1_1_16rem]">
				<span class="sr-only">搜尋訂單</span>
				<Search class="pointer-events-none absolute left-3 top-3 size-4 text-text-muted" />
				<input
					name="search"
					value={page.url.searchParams.get('search') ?? ''}
					placeholder="搜尋訂單或客戶"
					class="h-10 w-full rounded-md border border-border bg-bg-surface pl-9 pr-3 text-sm"
				/>
			</label>
			<label class="min-w-32 flex-1">
				<span class="sr-only">訂單狀態</span>
				<select
					name="status"
					class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
				>
					<option
						value=""
						selected={!page.url.searchParams.has('status')}
					>
						全部狀態
					</option>
					{#each data.statusOptions as option (option.value)}<option
							value={option.value}
							selected={page.url.searchParams.get('status') === option.value}
						>
							{option.label}
						</option>{/each}
				</select>
			</label>
			<label class="min-w-40 flex-1">
				<span class="sr-only">企業</span>
				<select
					name="businessId"
					class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
				>
					<option
						value=""
						selected={!page.url.searchParams.has('businessId')}
					>
						全部客戶
					</option>
					{#each data.businessOptions.filter((option) => option.value) as option (option.value)}<option
							value={option.value}
							selected={page.url.searchParams.get('businessId') === option.value}
						>
							{option.label}
						</option>{/each}
				</select>
			</label>
			<a
				href={resolve('/orders')}
				class="inline-grid size-10 shrink-0 cursor-pointer place-items-center rounded-md border border-border"
				aria-label="重設篩選"
				title="重設篩選"
			>
				<RotateCcw class="size-4" />
			</a>
		</form>
		<div class="overflow-x-auto">
			<table class="min-w-[980px] w-full text-left text-sm">
				<thead class="border-b border-border bg-bg-sunken text-xs text-text-muted">
					<tr>
						<th class="px-4 py-3">訂單</th>
						<th class="px-4 py-3">狀態</th>
						<th class="px-4 py-3">品項</th>
						<th class="px-4 py-3">金額</th>
						<th class="px-4 py-3">建立時間</th>
						<th class="px-4 py-3 text-right">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.orders as order (order.id)}
						<tr>
							<td class="px-4 py-4">
								<strong class="text-text-heading">#{order.id.slice(0, 8)}</strong>
								<p class="mt-1 text-xs text-text-muted">{order.businessName}</p>
							</td>
							<td class="px-4 py-4">
								<Badge tone={tone(order.status)}>{localizeAdminLabel(order.status)}</Badge>
							</td>
							<td class="px-4 py-4">{order.itemCount}</td>
							<td class="px-4 py-4 font-semibold text-text-heading">
								NT$ {order.totalAmount.toLocaleString('zh-TW')}
							</td>
							<td class="whitespace-nowrap px-4 py-4 text-text-muted">
								{formatDateTime(order.createdAt)}
							</td>
							<td class="px-4 py-4 text-right">
								<button
									type="button"
									class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
									aria-label="編輯訂單"
									title="編輯訂單"
									onclick={() => openEdit(order)}
								>
									<Edit3 class="size-4" />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pagination pagination={data.pagination} />
	</section>
</div>

<OrderCreateDrawer
	open={createOpen}
	businesses={data.businesses}
	businessOptions={data.businessOptions}
	onclose={() => (createOpen = false)}
	oncreate={submitCreate}
/>
<OrderDetailDrawer
	order={selected}
	businessOptions={data.businessOptions}
	statusOptions={data.statusOptions}
	bind:businessId={editBusinessId}
	onclose={() => (selected = null)}
	onsave={submitUpdate}
/>
