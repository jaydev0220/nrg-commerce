<script lang="ts">
	import { Sun, Moon } from '@lucide/svelte';
	import { theme } from '$lib/state/theme.svelte';
</script>

<button
	class="
		flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-sunken
		text-text-body transition-[color,background-color,border-color,transform]
		duration-200 hover:-translate-y-0.5 hover:border-border-accent hover:bg-bg-accent
		focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
	"
	onclick={() => theme.toggle()}
	aria-label="Toggle theme"
	title={theme.current === 'light' ? 'Light theme' : 'Dark theme'}
>
	{#if theme.current === 'dark'}
		<Moon class="h-4 w-4" aria-hidden="true" />
	{:else}
		<Sun class="h-4 w-4" aria-hidden="true" />
	{/if}
</button>
