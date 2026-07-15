<script lang="ts">
	import { Check } from '@lucide/svelte';

	import Drawer from '$lib/components/shared/Drawer.svelte';

	type BusinessLabel = { id: string; name: string; color: string; discountRate: number | null };

	let {
		open,
		mode,
		label,
		color,
		colors,
		oncolorchange,
		onclose,
		onsave
	}: {
		open: boolean;
		mode: 'create' | 'edit' | null;
		label: BusinessLabel | null;
		color: string;
		colors: string[];
		oncolorchange: (color: string) => void;
		onclose: () => void;
		onsave: (event: SubmitEvent) => void;
	} = $props();
</script>

<Drawer
	{open}
	title={mode === 'create' ? '新增企業標籤' : '編輯企業標籤'}
	{onclose}
>
	<form
		class="space-y-4"
		onsubmit={onsave}
	>
		<label class="block text-sm font-medium">
			標籤名稱
			<input
				required
				name="name"
				value={label?.name ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<fieldset>
			<legend class="text-sm font-medium">標籤顏色</legend>
			<input
				type="hidden"
				name="color"
				value={color}
			/>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each colors as swatch (swatch)}
					<button
						type="button"
						class="inline-grid size-9 cursor-pointer place-items-center rounded-full border-2 {color ===
						swatch
							? 'border-text-heading'
							: 'border-transparent'}"
						style={`background-color: ${swatch}`}
						aria-label={`選擇顏色 ${swatch}`}
						title={`選擇顏色 ${swatch}`}
						onclick={() => oncolorchange(swatch)}
					>
						{#if color === swatch}<Check class="size-4 text-white" />{/if}
					</button>
				{/each}
			</div>
		</fieldset>
		<label class="block text-sm font-medium">
			預設折扣（百分比）
			<input
				name="discountRate"
				type="number"
				min="0"
				max="100"
				step="0.01"
				value={label?.discountRate ?? ''}
				placeholder="選填"
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<button
			type="submit"
			class="h-10 w-full cursor-pointer rounded-md bg-brand text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
		>
			儲存標籤
		</button>
	</form>
</Drawer>
