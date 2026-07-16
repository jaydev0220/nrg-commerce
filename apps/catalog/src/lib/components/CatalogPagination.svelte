<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	type PageItem = number | 'ellipsis';
	type Props = {
		page: number;
		totalPages: number;
		getHref: (page: number) => string;
	};

	let { page, totalPages, getHref }: Props = $props();
	let pageItems = $derived.by<PageItem[]>(() => {
		if (totalPages <= 1) {
			return [];
		}

		const visiblePages = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
		const pages = [...visiblePages]
			.filter((pageNumber) => pageNumber > 0 && pageNumber <= totalPages)
			.sort((left, right) => left - right);
		const items: PageItem[] = [];

		for (const [index, pageNumber] of pages.entries()) {
			if (index > 0 && pageNumber - pages[index - 1]! > 1) {
				items.push('ellipsis');
			}
			items.push(pageNumber);
		}

		return items;
	});
</script>

{#if totalPages > 1}
	<nav
		class="mt-8 flex flex-wrap items-center justify-center gap-2"
		aria-label={m.catalog_pagination()}
	>
		{#if page > 1}
			<a
				class="inline-flex h-10 items-center gap-1 rounded-md border border-border bg-bg-surface px-3 text-sm font-medium text-text-body transition-colors hover:border-border-accent hover:bg-bg-accent"
				href={resolve(getHref(page - 1) as Pathname)}
				aria-label={m.catalog_previous_page()}
			>
				<ChevronLeft class="size-4" />
				<span class="hidden sm:inline">{m.catalog_previous_page()}</span>
			</a>
		{/if}

		<div class="flex items-center gap-1">
			{#each pageItems as item, index (`${item}-${index}`)}
				{#if item === 'ellipsis'}
					<span
						class="px-1 text-text-muted"
						aria-hidden="true"
					>
						...
					</span>
				{:else}
					<a
						class={`grid size-10 place-items-center rounded-md text-sm font-medium transition-colors ${item === page ? 'bg-brand text-text-on-accent' : 'border border-border bg-bg-surface text-text-body hover:border-border-accent hover:bg-bg-accent'}`}
						href={resolve(getHref(item) as Pathname)}
						aria-current={item === page ? 'page' : undefined}
					>
						{item}
					</a>
				{/if}
			{/each}
		</div>

		{#if page < totalPages}
			<a
				class="inline-flex h-10 items-center gap-1 rounded-md border border-border bg-bg-surface px-3 text-sm font-medium text-text-body transition-colors hover:border-border-accent hover:bg-bg-accent"
				href={resolve(getHref(page + 1) as Pathname)}
				aria-label={m.catalog_next_page()}
			>
				<span class="hidden sm:inline">{m.catalog_next_page()}</span>
				<ChevronRight class="size-4" />
			</a>
		{/if}
	</nav>
{/if}
