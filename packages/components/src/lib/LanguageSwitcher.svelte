<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import type { LanguageOption } from './types';

	type Props = {
		ariaLabel: string;
		currentLocale: string;
		onSelect: (locale: string) => void;
		options: LanguageOption[];
	};

	let { ariaLabel, currentLocale, onSelect, options }: Props = $props();

	let isOpen = $state(false);

	const currentOption = $derived(
		options.find((option) => option.value === currentLocale) ?? options[0]
	);

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function selectLanguage(locale: string) {
		onSelect(locale);
		isOpen = false;
	}

	function handleDocumentClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (isOpen && !target.closest('.language-switcher')) {
			isOpen = false;
		}
	}
</script>

<svelte:document onclick={handleDocumentClick} />

<div class="language-switcher relative">
	<button
		class="
			flex h-8 w-18 items-center justify-center gap-1 rounded border border-border bg-bg-sunken px-3 py-1.5
			text-sm font-medium transition-[color,background-color,border-color,transform]
			duration-200 hover:-translate-y-0.5 hover:border-border-accent hover:bg-bg-accent focus-visible:ring-2 focus-visible:ring-brand
			focus-visible:ring-offset-2 focus-visible:outline-none
		"
		onclick={toggleDropdown}
		aria-expanded={isOpen}
		aria-haspopup="listbox"
		aria-label={ariaLabel}
	>
		<span class="truncate text-text-body">
			{currentOption?.shortLabel}
		</span>
		<ChevronDown
			class={`h-3 w-3 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
			aria-hidden="true"
		/>
	</button>

	{#if isOpen}
		<div
			class="absolute top-full right-0 z-50 mt-1 w-20 min-w-full overflow-hidden rounded border border-border bg-bg-surface shadow-md"
			role="listbox"
		>
			{#each options as option (option.value)}
				<button
					class={`
						w-full px-3 py-2 text-left text-sm text-text-body transition-colors duration-200 hover:bg-bg-accent focus-visible:ring-2
						focus-visible:ring-brand focus-visible:outline-none
						${currentLocale === option.value ? 'bg-bg-accent' : ''}
					`}
					onclick={() => selectLanguage(option.value)}
					role="option"
					aria-selected={currentLocale === option.value}
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.language-switcher {
		--duration-base: 180ms;
		--ease-ui: cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
