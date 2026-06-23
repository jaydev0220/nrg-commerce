<script lang="ts">
	import { PackageSearch, RotateCcw } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	type Props = {
		onReset: () => void;
	};

	let { onReset }: Props = $props();
</script>

<div
	class="rounded-lg border border-dashed border-border-strong bg-bg-surface px-6 py-16 text-center"
>
	<PackageSearch class="mx-auto size-8 text-text-muted" />
	<h2 class="mt-4 text-xl tracking-normal">{m.catalog_empty_title()}</h2>
	<p class="mt-2 text-sm text-text-muted">{m.catalog_empty_body()}</p>
	<button
		type="button"
		class="mt-6 inline-flex items-center gap-2 rounded-md border border-border-strong bg-bg-surface px-3 py-2 text-sm font-semibold text-text-heading transition-[color,background-color,border-color,transform] duration-base ease-ui hover:-translate-y-0.5 hover:border-border-accent hover:bg-brand-subtle hover:text-text-accent"
		onclick={onReset}
	>
		<RotateCcw class="size-4" />
		{m.catalog_reset()}
	</button>
</div>
