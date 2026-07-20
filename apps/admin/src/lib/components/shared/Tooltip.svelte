<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, children }: { label: string; children: Snippet } = $props();
</script>

<span class="group relative inline-flex">
	{@render children()}
	<span
		class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-md bg-text-heading px-2 py-1 text-xs font-medium whitespace-nowrap text-bg-surface opacity-0 shadow-md transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
		role="tooltip"
		aria-hidden="true"
	>
		{label}
	</span>
</span>
