<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	import { localeFromPathname } from '$lib/catalog/query.js';

	let locale = $derived(localeFromPathname(page.url.pathname));
	let isNotFound = $derived(page.status === 404);
</script>

<main
	class="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center"
>
	<p class="font-mono text-sm tracking-[0.16em] text-text-muted">{page.status}</p>
	<h1 class="mt-4 text-3xl text-text-heading sm:text-4xl">
		{isNotFound ? m.catalog_error_not_found_title() : m.catalog_error_unavailable_title()}
	</h1>
	<p class="mt-4 max-w-lg text-text-muted">
		{isNotFound ? m.catalog_error_not_found_body() : m.catalog_error_unavailable_body()}
	</p>
	<div class="mt-8 flex flex-wrap justify-center gap-3">
		<a
			class="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-text-on-accent transition-colors hover:bg-brand-strong"
			href={resolve(`${page.url.pathname}${page.url.search}` as Pathname)}
		>
			{m.catalog_error_retry()}
		</a>
		<a
			class="rounded-md border border-border bg-bg-surface px-5 py-3 text-sm font-semibold text-text-body transition-colors hover:border-border-accent hover:bg-bg-accent"
			href={resolve(localizeHref('/', { locale }) as Pathname)}
		>
			{m.nav_home()}
		</a>
	</div>
</main>
