<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import AdminShell from '$lib/components/AdminShell.svelte';
	import type { LayoutData } from './$types';
	import './layout.css';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	const isLoginRoute = $derived(page.url.pathname === '/login');
</script>

{#if isLoginRoute}
	{@render children()}
{:else}
	<AdminShell currentStaff={data.currentStaff}>
		{@render children()}
	</AdminShell>
{/if}
