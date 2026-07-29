<script lang="ts">
	import { ArrowDown, ArrowUp, CircleMinus, CirclePlus, Pencil } from '@lucide/svelte';

	import type { ManagedOrderUpdatePreview } from '$lib/api/admin-api';
	import { localizeAdminLabel } from '$lib/labels';

	type Option = { value: string; label: string };

	let {
		preview,
		businessOptions
	}: { preview: ManagedOrderUpdatePreview; businessOptions: Option[] } = $props();

	const fieldLabels: Record<
		ManagedOrderUpdatePreview['changes']['fields'][number]['field'],
		string
	> = {
		status: '訂單狀態',
		businessId: '客戶類型',
		customerName: '客戶姓名',
		customerEmail: '電子郵件',
		customerPhone: '電話',
		customerAddress: '地址'
	};

	function businessLabel(value: string | null): string {
		if (!value) return '一般消費者';
		return businessOptions.find((option) => option.value === value)?.label ?? value;
	}

	function fieldValue(field: keyof typeof fieldLabels, value: string | null): string {
		if (field === 'status') return value ? localizeAdminLabel(value) : '未填寫';
		if (field === 'businessId') return businessLabel(value);
		return value || '未填寫';
	}

	function currency(value: number): string {
		return `NT$ ${value.toLocaleString('zh-TW')}`;
	}
</script>

<div class="space-y-5">
	<div class="rounded-md border border-warning/40 bg-warning-bg p-4 text-sm text-warning">
		<p class="font-semibold">請確認以下訂單變更</p>
		<p class="mt-1">確認後將同步更新訂單金額與商品庫存。</p>
	</div>

	{#if preview.changes.fields.length > 0}
		<section aria-labelledby="field-changes-heading">
			<h3
				id="field-changes-heading"
				class="text-sm font-semibold text-text-heading"
			>
				基本資料
			</h3>
			<ul class="mt-2 space-y-2">
				{#each preview.changes.fields as change (change.field)}
					<li class="rounded-md border border-warning/40 bg-warning-bg p-3 text-sm">
						<div class="flex items-center gap-2 font-semibold text-warning">
							<Pencil class="size-4" />{fieldLabels[change.field]}
						</div>
						<div
							class="mt-2 grid gap-1 text-text-muted sm:grid-cols-[1fr_auto_1fr] sm:items-center"
						>
							<span class="break-words">{fieldValue(change.field, change.before)}</span>
							<span aria-hidden="true">→</span>
							<strong class="break-words text-text-heading">
								{fieldValue(change.field, change.after)}
							</strong>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if preview.changes.items.length > 0}
		<section aria-labelledby="item-changes-heading">
			<h3
				id="item-changes-heading"
				class="text-sm font-semibold text-text-heading"
			>
				品項變更
			</h3>
			<ul class="mt-2 space-y-2">
				{#each preview.changes.items as change, index (`${change.kind}-${change.itemId ?? index}`)}
					{@const item = change.after ?? change.before}
					<li
						class="rounded-md border p-3 text-sm {change.kind === 'added'
							? 'border-success/40 bg-success-bg'
							: change.kind === 'removed'
								? 'border-danger/40 bg-danger-bg'
								: 'border-warning/40 bg-warning-bg'}"
					>
						<div
							class="flex items-center gap-2 font-semibold {change.kind === 'added'
								? 'text-success'
								: change.kind === 'removed'
									? 'text-danger'
									: 'text-warning'}"
						>
							{#if change.kind === 'added'}<CirclePlus
									class="size-4"
								/>新增品項{:else if change.kind === 'removed'}<CircleMinus
									class="size-4"
								/>移除品項{:else}<Pencil class="size-4" />修改品項{/if}
						</div>
						{#if item}<p class="mt-2 font-medium text-text-heading">{item.productName}</p>
							<p class="text-xs text-text-muted">{item.skuCode}</p>{/if}
						{#if change.kind === 'modified' && change.before && change.after}
							<div
								class="mt-2 grid gap-1 text-text-muted sm:grid-cols-[1fr_auto_1fr] sm:items-center"
							>
								<span>
									{change.before.quantity} 件 · {currency(change.before.unitPrice)} · {currency(
										change.before.lineTotal
									)}
								</span>
								<span aria-hidden="true">→</span>
								<strong class="text-text-heading">
									{change.after.quantity} 件 · {currency(change.after.unitPrice)} · {currency(
										change.after.lineTotal
									)}
								</strong>
							</div>
						{:else if item}
							<p class="mt-1 text-text-muted">
								{item.quantity} 件 · {currency(item.unitPrice)} · {currency(item.lineTotal)}
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="total-changes-heading">
		<h3
			id="total-changes-heading"
			class="text-sm font-semibold text-text-heading"
		>
			金額摘要
		</h3>
		<div class="mt-2 grid gap-2 rounded-md border border-border bg-bg-sunken p-3 sm:grid-cols-3">
			<div>
				<p class="text-xs text-text-muted">品項數量</p>
				<p class="font-semibold text-text-heading">
					{preview.changes.totals.before.itemCount} → {preview.changes.totals.after.itemCount}
				</p>
			</div>
			<div>
				<p class="text-xs text-text-muted">小計</p>
				<p class="font-semibold text-text-heading">
					{currency(preview.changes.totals.before.subtotalAmount)} → {currency(
						preview.changes.totals.after.subtotalAmount
					)}
				</p>
			</div>
			<div>
				<p class="text-xs text-text-muted">應付金額</p>
				<p class="font-semibold text-text-heading">
					{currency(preview.changes.totals.before.totalAmount)} → {currency(
						preview.changes.totals.after.totalAmount
					)}
				</p>
			</div>
		</div>
	</section>

	{#if preview.changes.inventory.length > 0}
		<section aria-labelledby="inventory-changes-heading">
			<h3
				id="inventory-changes-heading"
				class="text-sm font-semibold text-text-heading"
			>
				庫存影響
			</h3>
			<ul class="mt-2 divide-y divide-border rounded-md border border-border">
				{#each preview.changes.inventory as change (change.productSkuId)}
					<li class="flex items-center justify-between gap-3 p-3 text-sm">
						<span class="font-medium text-text-heading">{change.skuCode}</span>
						<span
							class="inline-flex items-center gap-1 font-semibold {change.stockDelta > 0
								? 'text-success'
								: 'text-danger'}"
						>
							{#if change.stockDelta > 0}<ArrowUp class="size-4" />庫存增加 {change.stockDelta}{:else}<ArrowDown
									class="size-4"
								/>庫存減少 {Math.abs(change.stockDelta)}{/if}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
