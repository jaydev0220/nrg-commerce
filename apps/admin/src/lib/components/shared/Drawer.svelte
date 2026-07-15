<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		open,
		title,
		onclose,
		children
	}: { open: boolean; title: string; onclose: () => void; children: Snippet } = $props();

	let drawerElement = $state<HTMLElement>();
	let closeButton = $state<HTMLButtonElement>();
	let previouslyFocused = $state<HTMLElement | null>(null);
	let wasOpen = false;

	const focusableSelector =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	$effect(() => {
		if (open && !wasOpen) {
			wasOpen = true;
			previouslyFocused =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;
			document.body.style.overflow = 'hidden';
			requestAnimationFrame(() => closeButton?.focus());
			return;
		}

		if (!open && wasOpen) {
			wasOpen = false;
			document.body.style.overflow = '';
			requestAnimationFrame(() => previouslyFocused?.focus());
			previouslyFocused = null;
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
			return;
		}
		if (event.key !== 'Tab' || !drawerElement) return;
		const focusable = Array.from(drawerElement.querySelectorAll<HTMLElement>(focusableSelector));
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!first || !last) return;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/35"
		role="presentation"
		onclick={onclose}
	></div>
	<dialog
		bind:this={drawerElement}
		class="fixed inset-y-0 right-0 left-auto z-50 m-0 flex h-dvh max-h-none w-full max-w-xl flex-col border-l border-border bg-bg-surface shadow-xl"
		open
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
		onclick={(event) => event.stopPropagation()}
		onkeydown={handleKeydown}
	>
		<header class="flex h-16 items-center justify-between border-b border-border px-5">
			<h2 class="text-lg font-semibold text-text-heading">{title}</h2>
			<button
				bind:this={closeButton}
				type="button"
				class="inline-grid size-9 cursor-pointer place-items-center rounded-md hover:bg-bg-sunken"
				onclick={onclose}
				aria-label="關閉"
			>
				<X class="size-5" />
			</button>
		</header>
		<div class="min-h-0 flex-1 overflow-y-auto p-5">{@render children()}</div>
	</dialog>
{/if}
