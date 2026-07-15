<script lang="ts">
	import { AdminApiError } from '$lib/api/admin-api';
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import type { ProductCategoryOption, ProductCreateInput } from './types';

	let {
		open,
		categoryOptions,
		onclose,
		oncreate
	}: {
		open: boolean;
		categoryOptions: ProductCategoryOption[];
		onclose: () => void;
		oncreate: (input: ProductCreateInput) => Promise<void>;
	} = $props();

	let errorMessage = $state('');
	let busy = $state(false);

	function optional(value: FormDataEntryValue | null): string | undefined {
		const normalized = String(value ?? '').trim();
		return normalized || undefined;
	}

	function message(error: unknown): string {
		return error instanceof AdminApiError || error instanceof Error
			? error.message
			: '無法建立商品。';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		const values = new FormData(event.currentTarget as HTMLFormElement);
		const slug = String(values.get('slug') ?? '').trim();
		const name = String(values.get('name') ?? '').trim();
		if (!slug || !name) {
			errorMessage = '請填寫商品名稱與網址代稱。';
			return;
		}
		busy = true;
		try {
			await oncreate({
				slug,
				name,
				nameEn: optional(values.get('nameEn')),
				description: optional(values.get('description')),
				descriptionEn: optional(values.get('descriptionEn')),
				categoryId: optional(values.get('categoryId')) ?? null,
				published: values.get('published') === 'on'
			});
			onclose();
		} catch (error) {
			errorMessage = message(error);
		} finally {
			busy = false;
		}
	}
</script>

<Drawer
	{open}
	title="新增商品"
	{onclose}
>
	<form
		class="space-y-4"
		onsubmit={submit}
	>
		{#if errorMessage}
			<p
				class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
				role="alert"
			>
				{errorMessage}
			</p>
		{/if}
		<label class="block text-sm font-medium">
			商品名稱
			<input
				required
				name="name"
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			網址代稱
			<input
				required
				name="slug"
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			英文名稱
			<input
				name="nameEn"
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			分類
			<select
				name="categoryId"
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			>
				{#each categoryOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
		<label class="block text-sm font-medium">
			中文說明
			<textarea
				name="description"
				rows="4"
				class="mt-1 w-full rounded-md border border-border bg-bg-surface p-3"></textarea>
		</label>
		<label class="block text-sm font-medium">
			英文說明
			<textarea
				name="descriptionEn"
				rows="4"
				class="mt-1 w-full rounded-md border border-border bg-bg-surface p-3"></textarea>
		</label>
		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				name="published"
				class="size-4"
			/>
			立即上架
		</label>
		<button
			type="submit"
			disabled={busy}
			class="h-10 w-full cursor-pointer rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
		>
			{busy ? '建立中...' : '建立商品'}
		</button>
	</form>
</Drawer>
