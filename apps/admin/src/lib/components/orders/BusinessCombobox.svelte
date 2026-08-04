<script lang="ts">
	import { Search, X } from '@lucide/svelte';

	import { loadBusinessLookups, type ManagedBusiness } from '$lib/api/admin-api';

	let {
		business = null,
		name = 'businessId',
		onselect,
		disabled = false,
		placeholder = '搜尋企業名稱、聯絡人或電話',
		listboxId = 'order-business-results'
	}: {
		business?: ManagedBusiness | null;
		name?: string;
		onselect: (business: ManagedBusiness | null) => void;
		disabled?: boolean;
		placeholder?: string;
		listboxId?: string;
	} = $props();

	let query = $state('');
	let open = $state(false);
	let loading = $state(false);
	let error = $state('');
	let results = $state<ManagedBusiness[]>([]);
	let highlightedIndex = $state(0);
	let composing = $state(false);
	let debounceHandle: ReturnType<typeof setTimeout> | undefined;
	let requestVersion = 0;

	const selectedId = $derived(business?.id ?? '');

	function contactSummary(value: ManagedBusiness): string {
		return (
			[value.contactName, value.contactPhone, value.contactEmail].filter(Boolean).join(' · ') ||
			'未提供聯絡資訊'
		);
	}

	function loadLabel(value: ManagedBusiness): string {
		return value.label?.name ? '標籤：' + value.label.name : '未設定標籤';
	}

	async function loadResults(value: string) {
		const version = ++requestVersion;
		loading = true;
		error = '';
		try {
			const response = await loadBusinessLookups(value);
			if (version !== requestVersion) return;
			results = response.data;
			highlightedIndex = 0;
		} catch {
			if (version === requestVersion) {
				results = [];
				error = '無法載入企業清單。';
			}
		} finally {
			if (version === requestVersion) loading = false;
		}
	}

	function scheduleSearch() {
		open = true;
		if (debounceHandle) clearTimeout(debounceHandle);
		debounceHandle = setTimeout(() => void loadResults(query), 250);
	}

	function openPicker() {
		open = true;
		if (results.length === 0 && !loading) void loadResults(query);
	}

	function choose(value: ManagedBusiness) {
		onselect(value);
		query = '';
		open = false;
	}

	function clearSelection() {
		onselect(null);
		query = '';
		results = [];
		open = false;
	}

	function handleInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		query = value;
		if (business) onselect(null);
		results = [];
		if (!composing) scheduleSearch();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (!open) void openPicker();
			else if (results.length > 0) highlightedIndex = (highlightedIndex + 1) % results.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (results.length > 0) {
				highlightedIndex = (highlightedIndex - 1 + results.length) % results.length;
			}
		} else if (event.key === 'Enter' && open) {
			const highlighted = results[highlightedIndex];
			if (!highlighted) return;
			event.preventDefault();
			choose(highlighted);
		} else if (event.key === 'Escape') {
			open = false;
		}
	}

	function closeAfterBlur() {
		setTimeout(() => (open = false), 120);
	}
</script>

<div class="relative min-w-0">
	<input
		type="hidden"
		{name}
		value={selectedId}
	/>
	{#if business}
		<div
			class="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border bg-bg-surface px-3"
		>
			<span class="min-w-0">
				<strong class="block truncate text-sm text-text-heading">{business.name}</strong>
				<span class="block truncate text-xs text-text-muted">{contactSummary(business)}</span>
			</span>
			<button
				type="button"
				class="inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-text-muted hover:bg-bg-sunken hover:text-text-heading"
				aria-label="清除企業"
				title="清除企業"
				onclick={clearSelection}
				{disabled}
			>
				<X class="size-4" />
			</button>
		</div>
	{:else}
		<div class="relative">
			<Search class="pointer-events-none absolute top-3 left-3 size-4 text-text-muted" />
			<input
				value={query}
				role="combobox"
				aria-autocomplete="list"
				aria-controls={listboxId}
				aria-expanded={open}
				aria-label="搜尋企業"
				autocomplete="off"
				{disabled}
				{placeholder}
				class="h-10 w-full rounded-md border border-border bg-bg-surface pr-3 pl-9 text-sm"
				onfocus={openPicker}
				oninput={handleInput}
				oncompositionstart={() => (composing = true)}
				oncompositionend={() => {
					composing = false;
					scheduleSearch();
				}}
				onkeydown={handleKeydown}
				onblur={closeAfterBlur}
			/>
		</div>
	{/if}
	{#if open && !business}
		<div
			id={listboxId}
			class="absolute inset-x-0 top-11 z-30 max-h-72 overflow-y-auto rounded-md border border-border bg-bg-surface p-1 shadow-lg"
			role="listbox"
		>
			{#if loading}
				<p class="px-3 py-3 text-sm text-text-muted">載入企業中…</p>
			{:else if error}
				<p class="px-3 py-3 text-sm text-danger">{error}</p>
			{:else if results.length === 0}
				<p class="px-3 py-3 text-sm text-text-muted">找不到符合的企業。</p>
			{:else}
				{#each results as item, index (item.id)}
					<button
						type="button"
						role="option"
						aria-selected={highlightedIndex === index}
						class="flex w-full cursor-pointer items-start justify-between gap-3 rounded px-3 py-2 text-left text-sm hover:bg-bg-sunken {highlightedIndex ===
						index
							? 'bg-bg-sunken'
							: ''}"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => choose(item)}
					>
						<span class="min-w-0">
							<strong class="block truncate text-text-heading">{item.name}</strong>
							<span class="block truncate text-xs text-text-muted">{contactSummary(item)}</span>
						</span>
						<span class="shrink-0 text-xs text-text-muted">{loadLabel(item)}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
