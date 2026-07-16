<script lang="ts">
	import { AlertTriangle, X } from '@lucide/svelte';

	import type { CategoryDeleteInput, ManagedCategory } from '$lib/api/admin-api';
	import { buildCategoryTree, collectDescendantIds, flattenCategoryTree } from './category-tree';

	type CategoryDetail = ManagedCategory & {
		children?: ManagedCategory[];
		productCount?: number;
	};

	type Props = {
		open: boolean;
		category: ManagedCategory | null;
		detail: CategoryDetail | null;
		categories: ManagedCategory[];
		loading: boolean;
		busy: boolean;
		onclose: () => void;
		onconfirm: (input: CategoryDeleteInput) => Promise<void> | void;
	};

	let { open, category, detail, categories, loading, busy, onclose, onconfirm }: Props = $props();

	let productDisposition = $state<'uncategorize' | 'reassign'>('uncategorize');
	let reassignToCategoryId = $state('');
	let errorMessage = $state('');
	let initializedCategoryId = '';

	const reassignmentOptions = $derived.by(() => {
		const tree = buildCategoryTree(categories);
		const current = flattenCategoryTree(tree).find(
			(entry) => entry.category.id === category?.id
		)?.category;
		const excludedIds = current ? collectDescendantIds(current) : new Set<string>();
		return categories.filter((option) => !excludedIds.has(option.id));
	});

	$effect(() => {
		if (!open) {
			initializedCategoryId = '';
			return;
		}
		if (!category || category.id === initializedCategoryId) return;
		initializedCategoryId = category.id;
		productDisposition = 'uncategorize';
		reassignToCategoryId = '';
		errorMessage = '';
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		if (!category || !detail) return;
		if (detail.productCount && productDisposition === 'reassign' && !reassignToCategoryId) {
			errorMessage = '請選擇要移入的商品分類。';
			return;
		}

		void onconfirm({
			productDisposition: detail.productCount ? productDisposition : 'reject',
			childDisposition: 'promote',
			...(productDisposition === 'reassign' && reassignToCategoryId ? { reassignToCategoryId } : {})
		});
	}

	function handleDialogKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-70 grid place-items-center p-4"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-labelledby="category-delete-title"
		onkeydown={handleDialogKeydown}
	>
		<div class="absolute inset-0 bg-black/45">
			<button
				type="button"
				class="absolute inset-0 h-full w-full cursor-default"
				aria-label="關閉刪除對話框"
				onclick={onclose}
			></button>
		</div>
		<div class="relative w-full max-w-lg rounded-lg border border-border bg-bg-surface shadow-xl">
			<header class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
				<div class="flex items-start gap-3">
					<span
						class="inline-grid size-9 shrink-0 place-items-center rounded-full bg-danger-bg text-danger"
					>
						<AlertTriangle class="size-4" />
					</span>
					<div>
						<h2
							id="category-delete-title"
							class="text-lg font-semibold text-text-heading"
						>
							刪除商品分類
						</h2>
						<p class="mt-1 text-sm text-text-muted">此操作會封存分類，不會立即移除資料。</p>
					</div>
				</div>
				<button
					type="button"
					class="inline-grid size-9 cursor-pointer place-items-center rounded-md text-text-muted hover:bg-bg-sunken"
					aria-label="關閉"
					onclick={onclose}
				>
					<X class="size-4" />
				</button>
			</header>

			<form
				class="space-y-4 p-5"
				onsubmit={submit}
			>
				<p class="text-sm text-text-body">
					確定要刪除「
					<strong>{category?.name}</strong>
					」嗎？子分類會移到目前分類的上一層。
				</p>

				{#if loading}
					<p class="rounded-md bg-bg-sunken p-3 text-sm text-text-muted">正在檢查分類使用情況…</p>
				{:else if detail}
					{#if detail.productCount}
						<fieldset class="space-y-2">
							<legend class="text-sm font-semibold text-text-heading">商品處理方式</legend>
							<p class="text-sm text-text-muted">此分類目前有 {detail.productCount} 個商品</p>
							<label class="flex cursor-pointer items-start gap-2 text-sm text-text-body">
								<input
									bind:group={productDisposition}
									type="radio"
									value="uncategorize"
									class="mt-0.5"
								/>
								<span>將商品設為未分類</span>
							</label>
							<label class="flex cursor-pointer items-start gap-2 text-sm text-text-body">
								<input
									bind:group={productDisposition}
									type="radio"
									value="reassign"
									class="mt-0.5"
								/>
								<span>移至其他分類</span>
							</label>
							{#if productDisposition === 'reassign'}
								<select
									bind:value={reassignToCategoryId}
									class="h-10 w-full rounded-md border border-border bg-bg-surface px-3"
								>
									<option value="">選擇分類</option>
									{#each reassignmentOptions as option (option.id)}
										<option value={option.id}>{option.name}</option>
									{/each}
								</select>
							{/if}
						</fieldset>
					{:else}
						<p class="rounded-md bg-bg-sunken p-3 text-sm text-text-muted">
							此分類目前沒有商品，可以直接刪除。
						</p>
					{/if}
				{:else}
					<p class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger">
						無法取得分類使用情況。
					</p>
				{/if}

				{#if errorMessage}
					<p
						class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
						role="alert"
					>
						{errorMessage}
					</p>
				{/if}

				<div class="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						class="h-10 cursor-pointer rounded-md border border-border px-4 text-sm font-semibold text-text-body hover:bg-bg-sunken"
						onclick={onclose}
					>
						取消
					</button>
					<button
						type="submit"
						disabled={busy || loading || !detail}
						class="h-10 cursor-pointer rounded-md bg-danger px-4 text-sm font-semibold text-white hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{busy ? '處理中…' : '確認刪除'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
