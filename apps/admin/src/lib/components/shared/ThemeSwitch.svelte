<script lang="ts">
	import { Moon, Sun } from '@lucide/svelte';
	import { onMount } from 'svelte';

	const STORAGE_KEY = 'nrg-admin-theme';

	let theme = $state<'light' | 'dark'>('light');

	function persistTheme(nextTheme: 'light' | 'dark') {
		localStorage.setItem(STORAGE_KEY, nextTheme);
	}

	function applyTheme(nextTheme: 'light' | 'dark') {
		theme = nextTheme;
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(nextTheme);
		document.documentElement.style.colorScheme = nextTheme;
		persistTheme(nextTheme);
	}

	function toggleTheme() {
		applyTheme(theme === 'light' ? 'dark' : 'light');
	}

	onMount(() => {
		const storedTheme = localStorage.getItem(STORAGE_KEY);
		if (storedTheme === 'light' || storedTheme === 'dark') {
			applyTheme(storedTheme);
			return;
		}

		theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
	});
</script>

<button
	type="button"
	class="inline-grid size-10 place-items-center rounded-md border border-border bg-bg-surface text-text-muted transition hover:border-border-strong hover:bg-bg-sunken hover:text-text-body focus:ring-2 focus:ring-brand-muted focus:outline-none"
	aria-label="切換主題"
	onclick={toggleTheme}
>
	{#if theme === 'dark'}
		<Moon class="size-4" />
	{:else}
		<Sun class="size-4" />
	{/if}
</button>
