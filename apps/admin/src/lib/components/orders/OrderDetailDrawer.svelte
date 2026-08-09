<script lang="ts">
	import { ArrowLeft, Check, LoaderCircle, RefreshCw } from '@lucide/svelte';

	import type {
		ManagedBusiness,
		ManagedOrder,
		ManagedOrderUpdatePreview,
		OrderUpdateInput
	} from '$lib/api/admin-api';
	import BusinessCombobox from '$lib/components/orders/BusinessCombobox.svelte';
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import {
		customerPhonePattern,
		normalizeInvoiceNumber,
		validateInvoiceNumber,
		validateOrderCustomerContact
	} from '$lib/order-validation';
	import OrderChangeReview from './OrderChangeReview.svelte';
	import OrderItemsEditor from './OrderItemsEditor.svelte';
	import {
		createOrderItemDrafts,
		toOrderUpdateItems,
		validateOrderItemDrafts,
		type OrderItemDraft
	} from './order-editor';

	type Option = { value: string; label: string };

	let {
		order: currentOrder,
		statusOptions,
		onclose,
		onpreview,
		onsave,
		onreload
	}: {
		order: ManagedOrder;
		statusOptions: Option[];
		onclose: () => void;
		onpreview: (orderId: string, input: OrderUpdateInput) => Promise<ManagedOrderUpdatePreview>;
		onsave: (orderId: string, input: OrderUpdateInput) => Promise<void>;
		onreload: (orderId: string) => Promise<void>;
	} = $props();

	let order = $derived(currentOrder);
	let businessId = $state('');
	let selectedBusiness = $state<ManagedBusiness | null>(null);
	let items = $derived<OrderItemDraft[]>(createOrderItemDrafts(order));
	let preview = $state<ManagedOrderUpdatePreview | null>(null);
	let pendingInput = $state<OrderUpdateInput | null>(null);
	let error = $state('');
	let busy = $state(false);

	$effect(() => {
		businessId = currentOrder.businessId ?? '';
		selectedBusiness = currentOrder.business;
	});

	const reviewBusinesses = $derived.by(() => {
		const values = [order.business, selectedBusiness].filter(
			(value): value is ManagedBusiness => value !== null
		);
		return [...new Map(values.map((value) => [value.id, value])).values()];
	});

	function selectBusiness(value: ManagedBusiness | null) {
		selectedBusiness = value;
		businessId = value?.id ?? '';
	}

	function optional(value: FormDataEntryValue | null): string | null {
		const normalized = String(value ?? '').trim();
		return normalized || null;
	}

	function invoiceNumber(value: FormDataEntryValue | null): string | null {
		const normalized = normalizeInvoiceNumber(optional(value));
		const error = validateInvoiceNumber(normalized);
		if (error) throw new Error(error);
		return normalized;
	}

	function message(value: unknown, fallback: string): string {
		return value instanceof Error ? value.message : fallback;
	}

	function hasChanges(value: ManagedOrderUpdatePreview): boolean {
		return (
			value.changes.fields.length > 0 ||
			value.changes.items.length > 0 ||
			value.changes.inventory.length > 0 ||
			JSON.stringify(value.changes.totals.before) !== JSON.stringify(value.changes.totals.after)
		);
	}

	async function review(event: SubmitEvent) {
		event.preventDefault();
		if (!order || busy) return;
		error = '';
		const itemError = validateOrderItemDrafts(items);
		if (itemError) {
			error = itemError;
			return;
		}
		const values = new FormData(event.currentTarget as HTMLFormElement);
		const customerName = optional(values.get('customerName'));
		const customerPhone = optional(values.get('customerPhone'));
		const contactError = validateOrderCustomerContact({
			businessId: businessId || null,
			customerName,
			customerPhone
		});
		if (contactError) {
			error = contactError;
			return;
		}
		const input: OrderUpdateInput = {
			version: order.version,
			status: String(values.get('status')) as ManagedOrder['status'],
			invoiceNumber: invoiceNumber(values.get('invoiceNumber')),
			businessId: businessId || null,
			customerName,
			customerEmail: optional(values.get('customerEmail')),
			customerPhone,
			customerAddress: optional(values.get('customerAddress')),
			notes: optional(values.get('notes')),
			items: toOrderUpdateItems(items)
		};
		busy = true;
		try {
			const result = await onpreview(order.id, input);
			if (!hasChanges(result)) {
				error = '尚未變更任何訂單資料。';
				return;
			}
			pendingInput = input;
			preview = result;
		} catch (value) {
			error = message(value, '無法產生訂單變更預覽。');
		} finally {
			busy = false;
		}
	}

	async function confirm() {
		if (!order || !pendingInput || busy) return;
		busy = true;
		error = '';
		try {
			await onsave(order.id, pendingInput);
		} catch (value) {
			error = message(value, '無法更新訂單。');
		} finally {
			busy = false;
		}
	}

	async function reload() {
		if (!order || busy) return;
		busy = true;
		error = '';
		try {
			await onreload(order.id);
			preview = null;
			pendingInput = null;
		} catch (value) {
			error = message(value, '無法重新載入訂單。');
		} finally {
			busy = false;
		}
	}
</script>

<Drawer
	open
	title={preview ? '確認訂單變更' : '編輯訂單'}
	{onclose}
	wide
>
	{#if order}
		<div class="space-y-5">
			<header>
				<p class="text-xs text-text-muted">{order.id}</p>
				<h2 class="mt-1 text-lg font-semibold text-text-heading">
					{order.business?.name ?? order.customerName ?? '一般消費者'}
				</h2>
			</header>

			{#if error}
				<div
					class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
					role="alert"
				>
					<p>{error}</p>
					{#if error.includes('變更') || error.includes('版本')}
						<button
							type="button"
							class="mt-2 inline-flex cursor-pointer items-center gap-1 font-semibold underline"
							onclick={reload}
							disabled={busy}
						>
							<RefreshCw class="size-4" />重新載入最新資料
						</button>
					{/if}
				</div>
			{/if}

			{#if preview}
				<OrderChangeReview
					{preview}
					businesses={reviewBusinesses}
				/>
				<div class="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
					<button
						type="button"
						class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-60"
						onclick={() => {
							preview = null;
							pendingInput = null;
							error = '';
						}}
						disabled={busy}
					>
						<ArrowLeft class="size-4" />返回編輯
					</button>
					<button
						type="button"
						class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
						onclick={confirm}
						disabled={busy}
					>
						{#if busy}<LoaderCircle class="size-4 animate-spin" />{:else}<Check
								class="size-4"
							/>{/if}
						確認並儲存
					</button>
				</div>
			{:else}
				<form
					class="space-y-5"
					onsubmit={review}
				>
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="block text-sm font-medium">
							訂單狀態
							<select
								name="status"
								value={order.status}
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								disabled={busy}
							>
								{#each statusOptions as option (option.value)}<option value={option.value}>
										{option.label}
									</option>{/each}
							</select>
						</label>
						<label class="block text-sm font-medium">
							客戶類型
							<BusinessCombobox
								business={selectedBusiness}
								onselect={selectBusiness}
								disabled={busy}
								placeholder="搜尋企業名稱、聯絡人或電話"
							/>
						</label>
						<label class="block text-sm font-medium">
							發票號碼（選填）
							<input
								name="invoiceNumber"
								value={order.invoiceNumber ?? ''}
								maxlength="50"
								pattern="[A-Za-z0-9]+"
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3 uppercase"
								disabled={busy}
							/>
						</label>
						<label class="block text-sm font-medium">
							客戶姓名
							<input
								name="customerName"
								value={order.customerName ?? ''}
								required={!businessId}
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								disabled={busy}
							/>
						</label>
						<label class="block text-sm font-medium">
							電子郵件
							<input
								name="customerEmail"
								type="email"
								value={order.customerEmail ?? ''}
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								disabled={busy}
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
								disabled={busy}
							/>
						</label>
						<label class="block text-sm font-medium">
							地址
							<input
								name="customerAddress"
								value={order.customerAddress ?? ''}
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								disabled={busy}
							/>
						</label>
						<label class="block text-sm font-medium sm:col-span-2">
							備註
							<textarea
								name="notes"
								maxlength="10000"
								rows="3"
								class="mt-1 w-full rounded-md border border-border bg-bg-surface p-3"
								disabled={busy}>{order.notes ?? ''}</textarea>
						</label>
					</div>

					<div class="grid gap-3 rounded-md border border-border bg-bg-sunken p-3 sm:grid-cols-3">
						<span class="text-sm text-text-muted">
							小計 <strong class="ml-1 text-text-heading">
								NT$ {order.subtotalAmount.toLocaleString('zh-TW')}
							</strong>
						</span>
						<span class="text-sm text-text-muted">
							折扣 <strong class="ml-1 text-text-heading">{order.discountRate}%</strong>
						</span>
						<span class="text-sm text-text-muted">
							應付 <strong class="ml-1 text-text-heading">
								NT$ {order.totalAmount.toLocaleString('zh-TW')}
							</strong>
						</span>
					</div>

					<OrderItemsEditor
						bind:items
						disabled={busy}
					/>

					<button
						type="submit"
						class="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
						disabled={busy}
					>
						{#if busy}<LoaderCircle class="size-4 animate-spin" />{/if}檢視變更
					</button>
				</form>
			{/if}
		</div>
	{/if}
</Drawer>
