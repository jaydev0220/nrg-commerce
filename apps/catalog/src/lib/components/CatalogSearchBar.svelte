<script lang="ts">
	import { Search } from '@lucide/svelte';

	type Props = {
		label: string;
		placeholder: string;
		value: string;
		oninput: (value: string) => void;
	};

	let { label, placeholder, value, oninput }: Props = $props();
</script>

<label class="relative block">
	<span class="sr-only">{label}</span>
	<Search
		class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
	/>
	<input
		type="search"
		class="h-11 w-full rounded-md border-border bg-bg-surface pr-3 pl-9 text-sm text-text-body shadow-xs placeholder:text-text-subtle focus:border-border-accent focus:ring-2 focus:ring-brand-muted"
		{placeholder}
		{value}
		oninput={(event) => oninput((event.currentTarget as HTMLInputElement).value)}
	/>
</label>
