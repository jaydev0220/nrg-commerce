<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';

	import {
		AdminApiError,
		type ManagedBusiness,
		type ManagedOrderSkuLookup,
		type OrderInput
	} from '$lib/api/admin-api';
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import SkuCombobox from '$lib/components/orders/SkuCombobox.svelte';
	import { customerPhonePattern, validateOrderCustomerContact } from '$lib/order-validation';

	type DraftItem = {
		id: number;
		productSkuId?: string;
		skuCode: string;
		productName: string;
		unitPrice: string;
		quantity: string;
		attributes: Record<string, unknown>;
		isCustom: boolean;
	};

	let {
		open,
		businesses,
		businessOptions,
		onclose,
		oncreate
	}: {
		open: boolean;
		businesses: ManagedBusiness[];
		businessOptions: Array<{ value: string; label: string }>;
		onclose: () => void;
		oncreate: (input: OrderInput, requestKey: string) => Promise<void>;
	} = $props();

	let formError = $state('');
	let draftBusinessId = $state('');
	let draftDiscountRate = $state<number | undefined>(undefined);
	let customItemOpen = $state(false);
	let customName = $state('');
	let customPrice = $state('');
	let customQuantity = $state('1');
	let items = $state<DraftItem[]>([]);
	let nextItemId = 1;
	let submitting = $state(false);
	let requestKey = $state<string | null>(null);
	let requestFingerprint = $state<string | null>(null);

	const selectedBusiness = $derived(
		businesses.find((business) => business.id === draftBusinessId) ?? null
	);
	const suggestedDiscountRate = $derived(selectedBusiness?.label?.discountRate ?? null);
	const draftSubtotal = $derived(
		items.reduce(
			(total, item) => total + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
			0
		)
	);
	const draftRate = $derived(draftDiscountRate ?? suggestedDiscountRate ?? 0);
	const draftDiscount = $derived(Math.round(draftSubtotal * draftRate) / 100);
	const draftTotal = $derived(Math.max(0, Math.round((draftSubtotal - draftDiscount) * 100) / 100));

	function resetDraft() {
		formError = '';
		draftBusinessId = '';
		draftDiscountRate = undefined;
		customItemOpen = false;
		customName = '';
		customPrice = '';
		customQuantity = '1';
		items = [];
		nextItemId = 1;
		submitting = false;
		requestKey = null;
		requestFingerprint = null;
	}

	function close() {
		resetDraft();
		onclose();
	}

	function addSku(sku: ManagedOrderSkuLookup) {
		formError = '';
		if (items.some((item) => item.productSkuId === sku.id)) {
			formError = '這個 SKU 已加入訂單，請直接調整數量。';
			return;
		}
		items = [
			...items,
			{
				id: nextItemId,
				productSkuId: sku.id,
				skuCode: sku.skuCode,
				productName: sku.productName,
				unitPrice: String(sku.price),
				quantity: '1',
				attributes: sku.attributes,
				isCustom: false
			}
		];
		nextItemId += 1;
	}

	function addCustomItem() {
		const name = customName.trim();
		const price = Number(customPrice);
		const quantity = Number(customQuantity);
		if (
			!name ||
			!Number.isFinite(price) ||
			price < 0 ||
			!Number.isInteger(quantity) ||
			quantity < 1
		) {
			formError = '請填寫自訂商品名稱、有效價格與數量。';
			return;
		}
		items = [
			...items,
			{
				id: nextItemId,
				skuCode: `CUSTOM-${nextItemId}`,
				productName: name,
				unitPrice: String(price),
				quantity: String(quantity),
				attributes: {},
				isCustom: true
			}
		];
		nextItemId += 1;
		customName = '';
		customPrice = '';
		customQuantity = '1';
		customItemOpen = false;
		formError = '';
	}

	function updateItem(itemId: number, key: 'unitPrice' | 'quantity', value: string) {
		items = items.map((item) => (item.id === itemId ? { ...item, [key]: value } : item));
	}

	function removeItem(id: number) {
		items = items.filter((item) => item.id !== id);
	}

	function optional(value: FormDataEntryValue | null): string | null {
		const normalized = String(value ?? '').trim();
		return normalized || null;
	}

	function buildOrderItems(): OrderInput['items'] {
		return items.map((item) => ({
			productSkuId: item.productSkuId,
			skuCode: item.skuCode,
			productName: item.productName.trim(),
			unitPrice: Number(item.unitPrice),
			quantity: Number(item.quantity),
			attributes: item.attributes
		}));
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		formError = '';
		try {
			const values = new FormData(event.currentTarget as HTMLFormElement);
			if (items.length === 0) throw new Error('請先選擇商品 SKU 或新增自訂商品。');
			const businessId = optional(values.get('businessId'));
			const customerName = optional(values.get('customerName'));
			const customerPhone = optional(values.get('customerPhone'));
			const contactError = validateOrderCustomerContact({
				businessId,
				customerName,
				customerPhone
			});
			if (contactError) throw new Error(contactError);
			const orderItems = buildOrderItems();
			if (
				draftDiscountRate !== undefined &&
				(!Number.isFinite(draftDiscountRate) || draftDiscountRate < 0 || draftDiscountRate > 100)
			) {
				throw new Error('折扣必須介於 0 到 100。');
			}
			if (
				orderItems.some(
					(item) =>
						!item.skuCode ||
						!item.productName ||
						!Number.isFinite(item.unitPrice) ||
						item.unitPrice < 0 ||
						!Number.isInteger(item.quantity) ||
						item.quantity < 1
				)
			) {
				throw new Error('請確認所有訂單品項的價格與數量。');
			}
			const input: OrderInput = {
				businessId,
				customerName,
				customerEmail: optional(values.get('customerEmail')),
				customerPhone,
				customerAddress: optional(values.get('customerAddress')),
				discountRate: draftDiscountRate,
				items: orderItems
			};
			const fingerprint = JSON.stringify(input);
			if (requestFingerprint !== fingerprint) {
				requestFingerprint = fingerprint;
				requestKey = globalThis.crypto.randomUUID();
			}
			submitting = true;
			await oncreate(input, requestKey!);
			close();
		} catch (error) {
			formError =
				error instanceof AdminApiError || error instanceof Error ? error.message : '無法建立訂單。';
		} finally {
			submitting = false;
		}
	}
</script>

<Drawer
	{open}
	title="建立訂單"
	onclose={close}
>
	<form
		class="space-y-4"
		onsubmit={submit}
	>
		<label class="block text-sm font-medium">
			客戶類型
			<select
				name="businessId"
				bind:value={draftBusinessId}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			>
				{#each businessOptions as option (option.value)}<option value={option.value}>
						{option.label}
					</option>{/each}
			</select>
		</label>
		{#if selectedBusiness?.label}
			<p class="rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm text-text-muted">
				企業標籤：
				<strong class="text-text-heading">{selectedBusiness.label.name}</strong>
				，預設折扣 {selectedBusiness.label.discountRate ?? 0}%
			</p>
		{/if}
		<label class="block text-sm font-medium">
			折扣覆寫（百分比）
			<input
				name="discountRate"
				bind:value={draftDiscountRate}
				type="number"
				min="0"
				max="100"
				step="0.01"
				placeholder={String(suggestedDiscountRate ?? '')}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<div class="grid gap-3 rounded-md border border-border bg-bg-sunken p-3 sm:grid-cols-3">
			<span class="text-sm text-text-muted">
				小計 <strong class="ml-1 text-text-heading">
					NT$ {draftSubtotal.toLocaleString('zh-TW')}
				</strong>
			</span>
			<span class="text-sm text-text-muted">
				折扣 <strong class="ml-1 text-text-heading">
					NT$ {draftDiscount.toLocaleString('zh-TW')}
				</strong>
			</span>
			<span class="text-sm text-text-muted">
				應付 <strong class="ml-1 text-text-heading">
					NT$ {draftTotal.toLocaleString('zh-TW')}
				</strong>
			</span>
		</div>

		<div class="space-y-3">
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-sm font-semibold text-text-heading">訂單品項</h2>
				<button
					type="button"
					class="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-sm font-semibold"
					aria-label="新增自訂商品"
					title="新增自訂商品"
					onclick={() => (customItemOpen = !customItemOpen)}
				>
					<Plus class="size-4" />自訂商品
				</button>
			</div>
			<SkuCombobox onselect={addSku} />
			{#if customItemOpen}
				<fieldset
					class="grid gap-3 rounded-md border border-brand/40 bg-bg-sunken p-3 sm:grid-cols-3"
				>
					<legend class="sr-only">新增自訂商品</legend>
					<label class="text-sm font-medium">
						商品名稱
						<input
							bind:value={customName}
							class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
						/>
					</label>
					<label class="text-sm font-medium">
						單價
						<input
							bind:value={customPrice}
							type="number"
							min="0"
							step="0.01"
							class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
						/>
					</label>
					<label class="text-sm font-medium">
						數量
						<input
							bind:value={customQuantity}
							type="number"
							min="1"
							step="1"
							class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
						/>
					</label>
					<div class="flex items-end justify-end gap-2 sm:col-span-3">
						<button
							type="button"
							class="h-9 cursor-pointer rounded-md border border-border px-3 text-sm"
							onclick={() => (customItemOpen = false)}
						>
							取消
						</button>
						<button
							type="button"
							class="h-9 cursor-pointer rounded-md bg-brand px-3 text-sm font-semibold text-text-on-accent"
							onclick={addCustomItem}
						>
							加入品項
						</button>
					</div>
				</fieldset>
			{/if}
			{#if items.length === 0}
				<p
					class="rounded-md border border-dashed border-border p-4 text-center text-sm text-text-muted"
				>
					請先選擇商品 SKU。
				</p>
			{:else}
				<div class="space-y-2">
					{#each items as item (item.id)}
						<fieldset
							class="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]"
						>
							<legend class="sr-only">{item.productName}</legend>
							<div class="min-w-0">
								<strong class="block truncate text-text-heading">{item.productName}</strong>
								<span class="text-xs text-text-muted">
									{item.isCustom ? '自訂商品' : item.skuCode}
								</span>
							</div>
							<label class="text-sm font-medium">
								單價
								<input
									aria-label={`${item.productName} 單價`}
									value={item.unitPrice}
									type="number"
									min="0"
									step="0.01"
									oninput={(event) =>
										updateItem(
											item.id,
											'unitPrice',
											(event.currentTarget as HTMLInputElement).value
										)}
									class="mt-1 h-9 w-full rounded-md border border-border bg-bg-surface px-2"
								/>
							</label>
							<label class="text-sm font-medium">
								數量
								<input
									aria-label={`${item.productName} 數量`}
									value={item.quantity}
									type="number"
									min="1"
									step="1"
									oninput={(event) =>
										updateItem(
											item.id,
											'quantity',
											(event.currentTarget as HTMLInputElement).value
										)}
									class="mt-1 h-9 w-full rounded-md border border-border bg-bg-surface px-2"
								/>
							</label>
							<button
								type="button"
								class="inline-grid size-9 cursor-pointer place-items-center self-end rounded-md border border-border text-danger"
								aria-label={`移除${item.productName}`}
								title="移除品項"
								onclick={() => removeItem(item.id)}
							>
								<Trash2 class="size-4" />
							</button>
						</fieldset>
					{/each}
				</div>
			{/if}
		</div>

		{#if formError}<p
				class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
				role="alert"
			>
				{formError}
			</p>{/if}
		<div class="grid gap-3 sm:grid-cols-2">
			<label class="text-sm font-medium">
				客戶姓名
				<input
					name="customerName"
					required={!draftBusinessId}
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
				/>
			</label>
			<label class="text-sm font-medium">
				電子郵件
				<input
					name="customerEmail"
					type="email"
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
				/>
			</label>
			<label class="text-sm font-medium">
				電話
				<input
					name="customerPhone"
					required={!draftBusinessId}
					pattern={customerPhonePattern}
					maxlength="32"
					inputmode="tel"
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
				/>
			</label>
			<label class="text-sm font-medium">
				地址
				<input
					name="customerAddress"
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
				/>
			</label>
		</div>
		<button
			type="submit"
			class="h-10 w-full cursor-pointer rounded-md bg-brand text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
			disabled={submitting}
		>
			{submitting ? '建立中…' : '建立訂單'}
		</button>
	</form>
</Drawer>
