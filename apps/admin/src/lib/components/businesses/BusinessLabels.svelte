<script lang="ts">
	import { Pencil, Plus, Trash2, Undo2 } from '@lucide/svelte';

	type BusinessLabel = {
		id: string;
		name: string;
		color: string;
		discountRate: number | null;
		deletedAt: Date | null;
	};

	let {
		labels,
		canWrite,
		labelView,
		onviewchange,
		onopen,
		onstate
	}: {
		labels: BusinessLabel[];
		canWrite: boolean;
		labelView: 'active' | 'archived';
		onviewchange: (view: 'active' | 'archived') => void;
		onopen: (label?: BusinessLabel) => void;
		onstate: (event: SubmitEvent, restore: boolean) => void;
	} = $props();

	const visibleLabels = $derived(
		labels.filter((label) =>
			labelView === 'archived' ? Boolean(label.deletedAt) : !label.deletedAt
		)
	);
</script>

<aside class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
	<div class="flex items-start justify-between gap-3">
		<h2 class="text-lg font-semibold text-text-heading">企業標籤</h2>
		{#if canWrite}
			<button
				type="button"
				class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
				aria-label="新增企業標籤"
				title="新增企業標籤"
				onclick={() => onopen()}
			>
				<Plus class="size-4" />
			</button>
		{/if}
	</div>
	<div
		class="mt-3 flex rounded-md border border-border bg-bg-sunken p-1"
		role="tablist"
		aria-label="標籤檢視"
	>
		<button
			role="tab"
			type="button"
			class={`h-8 flex-1 cursor-pointer rounded px-2 text-xs font-semibold ${labelView === 'active' ? 'bg-bg-surface text-text-heading shadow-xs' : 'text-text-muted'}`}
			aria-selected={labelView === 'active'}
			onclick={() => onviewchange('active')}
		>
			啟用中
		</button>
		<button
			role="tab"
			type="button"
			class={`h-8 flex-1 cursor-pointer rounded px-2 text-xs font-semibold ${labelView === 'archived' ? 'bg-bg-surface text-text-heading shadow-xs' : 'text-text-muted'}`}
			aria-selected={labelView === 'archived'}
			onclick={() => onviewchange('archived')}
		>
			已封存
		</button>
	</div>
	<div class="mt-3 space-y-2">
		{#if visibleLabels.length === 0}
			<p
				class="rounded-md border border-dashed border-border p-4 text-center text-sm text-text-muted"
			>
				目前沒有企業標籤。
			</p>
		{:else}
			{#each visibleLabels as label (label.id)}
				<article class="rounded-md border border-border bg-bg-sunken px-3 py-2">
					<div class="flex items-center gap-2">
						<span
							class="size-2.5 shrink-0 rounded-full"
							style={`background-color: ${label.color}`}
						></span>
						<p class="min-w-0 flex-1 truncate text-sm font-semibold text-text-heading">
							{label.name}
						</p>
						{#if label.discountRate !== null}
							<span class="shrink-0 text-xs text-text-muted">{label.discountRate}%</span>
						{/if}
						{#if canWrite && !label.deletedAt}
							<button
								type="button"
								class="inline-grid size-8 cursor-pointer place-items-center rounded-md border border-border"
								aria-label={`編輯${label.name}`}
								title="編輯標籤"
								onclick={() => onopen(label)}
							>
								<Pencil class="size-3.5" />
							</button>
						{/if}
						{#if canWrite}
							<form onsubmit={(event) => onstate(event, Boolean(label.deletedAt))}>
								<input
									type="hidden"
									name="labelId"
									value={label.id}
								/>
								<button
									type="submit"
									class="inline-grid size-8 cursor-pointer place-items-center rounded-md border border-border {label.deletedAt
										? ''
										: 'text-danger'}"
									aria-label={label.deletedAt ? `還原${label.name}` : `封存${label.name}`}
									title={label.deletedAt ? '還原標籤' : '封存標籤'}
								>
									{#if label.deletedAt}<Undo2 class="size-3.5" />{:else}<Trash2
											class="size-3.5"
										/>{/if}
								</button>
							</form>
						{/if}
					</div>
				</article>
			{/each}
		{/if}
	</div>
</aside>
