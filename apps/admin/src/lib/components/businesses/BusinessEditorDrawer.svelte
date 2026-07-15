<script lang="ts">
	import Drawer from '$lib/components/shared/Drawer.svelte';

	type Business = {
		id: string;
		name: string;
		contactName: string | null;
		contactEmail: string | null;
		contactPhone: string | null;
		taxId: string | null;
		address: string | null;
		notes: string | null;
		labelId: string | null;
	};

	type BusinessLabel = {
		id: string;
		name: string;
		discountRate: number | null;
		deletedAt: Date | null;
	};

	let {
		open,
		mode,
		business,
		labels,
		onclose,
		onsave
	}: {
		open: boolean;
		mode: 'create' | 'edit' | null;
		business: Business | null;
		labels: BusinessLabel[];
		onclose: () => void;
		onsave: (event: SubmitEvent) => void;
	} = $props();

	const activeLabels = $derived(labels.filter((label) => !label.deletedAt));
</script>

<Drawer
	{open}
	title={mode === 'create' ? '新增企業' : '編輯企業'}
	{onclose}
>
	<form
		class="space-y-4"
		onsubmit={onsave}
	>
		<label class="block text-sm font-medium">
			企業名稱
			<input
				required
				name="name"
				value={business?.name ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			企業標籤
			<select
				name="labelId"
				value={business?.labelId ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			>
				<option value="">不套用標籤</option>
				{#each activeLabels as label (label.id)}
					<option value={label.id}>
						{label.name}{label.discountRate === null ? '' : `（${label.discountRate}%）`}
					</option>
				{/each}
			</select>
		</label>
		<label class="block text-sm font-medium">
			聯絡人
			<input
				name="contactName"
				value={business?.contactName ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			電子郵件
			<input
				type="email"
				name="contactEmail"
				value={business?.contactEmail ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			電話
			<input
				name="contactPhone"
				value={business?.contactPhone ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			統一編號
			<input
				name="taxId"
				value={business?.taxId ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			地址
			<input
				name="address"
				value={business?.address ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			備註
			<textarea
				name="notes"
				rows="4"
				class="mt-1 w-full rounded-md border border-border bg-bg-surface p-3">{business?.notes ??
					''}</textarea>
		</label>
		<button
			type="submit"
			class="h-10 w-full cursor-pointer rounded-md bg-brand text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
		>
			儲存企業
		</button>
	</form>
</Drawer>
