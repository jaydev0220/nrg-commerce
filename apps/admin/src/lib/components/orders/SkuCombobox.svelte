<script lang="ts">
	import Search from '@lucide/svelte/icons/search';

	import { loadOrderSkuLookups, type ManagedOrderSkuLookup } from '$lib/api/admin-api';

	let {
		onselect,
		disabled = false
	}: { onselect: (sku: ManagedOrderSkuLookup) => void; disabled?: boolean } = $props();

	let query = $state('');
	let open = $state(false);
	let loading = $state(false);
	let error = $state('');
	let results = $state<ManagedOrderSkuLookup[]>([]);
	let highlightedIndex = $state(0);
	let debounceHandle: ReturnType<typeof setTimeout> | undefined;
	let requestVersion = 0;

	async function loadResults(value: string) {
		const version = ++requestVersion;
		loading = true;
		error = '';
		try {
			const response = await loadOrderSkuLookups(value);
			if (version !== requestVersion) return;
			results = response.data;
			highlightedIndex = 0;
		} catch {
			if (version === requestVersion) {
				results = [];
				error = '無法載入商品清單。';
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

	function choose(sku: ManagedOrderSkuLookup) {
		onselect(sku);
		query = '';
		open = false;
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
	<div class="relative">
		<Search class="pointer-events-none absolute top-3 left-3 size-4 text-text-muted" />
		<input
			value={query}
			role="combobox"
			aria-autocomplete="list"
			aria-controls="order-sku-results"
			aria-expanded={open}
			aria-label="搜尋商品 SKU"
			autocomplete="off"
			{disabled}
			placeholder="搜尋商品名稱或 SKU"
			class="h-10 w-full rounded-md border border-border bg-bg-surface pr-3 pl-9 text-sm"
			onfocus={openPicker}
			oninput={(event) => {
				query = (event.currentTarget as HTMLInputElement).value;
				scheduleSearch();
			}}
			onkeydown={handleKeydown}
			onblur={closeAfterBlur}
		/>
	</div>
	{#if open}
		<div
			id="order-sku-results"
			class="absolute inset-x-0 top-11 z-30 max-h-64 overflow-y-auto rounded-md border border-border bg-bg-surface p-1 shadow-lg"
			role="listbox"
		>
			{#if loading}
				<p class="px-3 py-3 text-sm text-text-muted">載入商品中…</p>
			{:else if error}
				<p class="px-3 py-3 text-sm text-danger">{error}</p>
			{:else if results.length === 0}
				<p class="px-3 py-3 text-sm text-text-muted">找不到符合的商品。</p>
			{:else}
				{#each results as sku, index (sku.id)}
					<button
						type="button"
						role="option"
						aria-selected={highlightedIndex === index}
						class="flex w-full cursor-pointer items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm hover:bg-bg-sunken {highlightedIndex ===
						index
							? 'bg-bg-sunken'
							: ''}"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => choose(sku)}
					>
						<span class="min-w-0">
							<strong class="block truncate text-text-heading">{sku.productName}</strong>
							<span class="text-xs text-text-muted">{sku.skuCode}</span>
						</span>
						<span class="shrink-0 font-semibold text-text-heading">
							NT$ {sku.price.toLocaleString('zh-TW')}
						</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
