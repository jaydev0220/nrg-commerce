<script lang="ts">
	import { AdminApiError } from '$lib/api/admin-api';
	import type { ManagedCategory, ManagedProduct } from '$lib/api/admin-api';
	import type { ProductProfileInput } from './types';

	let {
		product,
		categories,
		onsave
	}: {
		product: ManagedProduct;
		categories: ManagedCategory[];
		onsave: (input: ProductProfileInput) => Promise<void>;
	} = $props();

	let errorMessage = $state('');
	let successMessage = $state('');
	let busy = $state(false);

	function message(error: unknown): string {
		return error instanceof AdminApiError || error instanceof Error
			? error.message
			: '無法更新商品資料。';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		successMessage = '';
		const values = new FormData(event.currentTarget as HTMLFormElement);
		const name = String(values.get('name') ?? '').trim();
		const slug = String(values.get('slug') ?? '').trim();
		if (!name || !slug) {
			errorMessage = '請填寫商品名稱與網址代稱。';
			return;
		}
		busy = true;
		try {
			await onsave({
				slug,
				name,
				nameEn: String(values.get('nameEn') ?? '').trim() || null,
				description: String(values.get('description') ?? '').trim() || null,
				descriptionEn: String(values.get('descriptionEn') ?? '').trim() || null,
				categoryId: String(values.get('categoryId') ?? '').trim() || null,
				published: values.get('published') === 'on'
			});
			successMessage = '已更新商品資料。';
		} catch (error) {
			errorMessage = message(error);
		} finally {
			busy = false;
		}
	}
</script>

<section class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
	<h2 class="text-lg font-semibold text-text-heading">商品資料</h2>
	{#if errorMessage}
		<p
			class="mt-4 rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}
	{#if successMessage}
		<p class="mt-4 rounded-md border border-success/30 bg-success-bg p-3 text-sm text-success">
			{successMessage}
		</p>
	{/if}
	<form
		class="mt-4 grid gap-4 md:grid-cols-2"
		onsubmit={submit}
	>
		<label class="block text-sm font-medium">
			商品名稱
			<input
				required
				name="name"
				value={product.name}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			網址代稱
			<input
				required
				name="slug"
				value={product.slug}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			英文名稱
			<input
				name="nameEn"
				value={product.nameEn ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			商品分類
			<select
				name="categoryId"
				value={product.categoryId ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			>
				<option value="">未分類</option>
				{#each categories as category (category.id)}
					<option value={category.id}>{category.name}</option>
				{/each}
			</select>
		</label>
		<label class="block text-sm font-medium md:col-span-2">
			商品描述
			<textarea
				name="description"
				rows="3"
				class="mt-1 w-full rounded-md border border-border bg-bg-surface p-3">{product.description ??
					''}</textarea>
		</label>
		<label class="block text-sm font-medium md:col-span-2">
			英文描述
			<textarea
				name="descriptionEn"
				rows="3"
				class="mt-1 w-full rounded-md border border-border bg-bg-surface p-3">{product.descriptionEn ??
					''}</textarea>
		</label>
		<label class="flex items-center gap-2 text-sm font-medium">
			<input
				type="checkbox"
				name="published"
				checked={product.published}
			/>
			已上架
		</label>
		<div class="md:col-span-2">
			<button
				type="submit"
				disabled={busy}
				class="h-10 cursor-pointer rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent disabled:cursor-not-allowed disabled:opacity-55"
			>
				{busy ? '儲存中...' : '儲存商品'}
			</button>
		</div>
	</form>
</section>
