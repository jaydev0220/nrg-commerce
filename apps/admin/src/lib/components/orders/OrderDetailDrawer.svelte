<script lang="ts">
	import { type ManagedOrder } from '$lib/api/admin-api';
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import { customerPhonePattern } from '$lib/order-validation';

	type Option = { value: string; label: string };

	let {
		order,
		businessOptions,
		statusOptions,
		businessId = $bindable(''),
		onclose,
		onsave
	}: {
		order: ManagedOrder | null;
		businessOptions: Option[];
		statusOptions: Option[];
		businessId?: string;
		onclose: () => void;
		onsave: (event: SubmitEvent) => void;
	} = $props();
</script>

<Drawer
	open={order !== null}
	title="訂單詳細資料"
	{onclose}
>
	{#if order}
		<div class="space-y-5">
			<header>
				<p class="text-xs text-text-muted">{order.id}</p>
				<h2 class="mt-1 text-lg font-semibold text-text-heading">
					{order.business?.name ?? '一般消費者'}
				</h2>
			</header>
			<div class="grid gap-3 rounded-md border border-border bg-bg-sunken p-3 sm:grid-cols-3">
				<span class="text-sm text-text-muted">
					小計 <strong class="ml-1 text-text-heading">
						NT$ {order.subtotalAmount.toLocaleString('zh-TW')}
					</strong>
				</span>
				<span class="text-sm text-text-muted">
					折扣 <strong class="ml-1 text-text-heading">
						{order.discountRate}%（NT$ {order.discountAmount.toLocaleString('zh-TW')}）
					</strong>
				</span>
				<span class="text-sm text-text-muted">
					應付 <strong class="ml-1 text-text-heading">
						NT$ {order.totalAmount.toLocaleString('zh-TW')}
					</strong>
				</span>
			</div>
			{#if order.discountLabelName}<p class="text-sm text-text-muted">
					套用標籤：
					<strong class="text-text-heading">{order.discountLabelName}</strong>
				</p>{/if}
			<form
				class="space-y-4"
				onsubmit={onsave}
			>
				<label class="block text-sm font-medium">
					訂單狀態
					<select
						name="status"
						value={order.status}
						class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
					>
						{#each statusOptions as option (option.value)}<option value={option.value}>
								{option.label}
							</option>{/each}
					</select>
				</label>
				<label class="block text-sm font-medium">
					客戶類型
					<select
						name="businessId"
						bind:value={businessId}
						class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
					>
						<option value="">一般消費者</option>
						{#each businessOptions.filter((option) => option.value) as option (option.value)}<option
								value={option.value}
							>
								{option.label}
							</option>{/each}
					</select>
				</label>
				<label class="block text-sm font-medium">
					客戶姓名
					<input
						name="customerName"
						value={order.customerName ?? ''}
						required={!businessId}
						class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
					/>
				</label>
				<label class="block text-sm font-medium">
					電子郵件
					<input
						name="customerEmail"
						type="email"
						value={order.customerEmail ?? ''}
						class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
					/>
				</label>
				<label class="block text-sm font-medium">
					電話
					<input
						name="customerPhone"
						value={order.customerPhone ?? ''}
						required={!businessId}
						pattern={customerPhonePattern}
						maxlength="32"
						inputmode="tel"
						class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
					/>
				</label>
				<label class="block text-sm font-medium">
					地址
					<input
						name="customerAddress"
						value={order.customerAddress ?? ''}
						class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
					/>
				</label>
				<button
					type="submit"
					class="h-10 w-full cursor-pointer rounded-md bg-brand text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
				>
					儲存訂單
				</button>
			</form>
			<div>
				<h3 class="text-sm font-semibold text-text-heading">訂單品項</h3>
				<ul class="mt-2 divide-y divide-border rounded-md border border-border">
					{#each order.items as item (item.id)}
						<li class="flex items-center justify-between gap-3 p-3 text-sm">
							<span>
								<strong class="text-text-heading">{item.productName}</strong>
								<span class="ml-2 text-text-muted">{item.skuCode} × {item.quantity}</span>
							</span>
							<span class="font-semibold text-text-heading">
								NT$ {item.lineTotal.toLocaleString('zh-TW')}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}
</Drawer>
