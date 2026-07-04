<script lang="ts">
	import { Lightbulb } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
	import { localeFromPathname } from '$lib/catalog/query.js';
	import { localizeHref } from '$lib/paraglide/runtime';

	let locale = $derived(localeFromPathname(page.url.pathname));
	let inquiryHref = $derived(localizeHref('/inquiry', { locale }) as Pathname);
</script>

<div class="rounded-lg border border-border-accent bg-bg-accent p-4">
	<Lightbulb class="mb-3 size-5 text-text-accent" />
	<h3 class="text-sm font-semibold">{m.catalog_help_title()}</h3>
	<p class="mt-1 text-xs leading-relaxed text-text-muted">{m.catalog_help_body()}</p>
	<a
		href={resolve(inquiryHref)}
		class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-text-accent transition-transform duration-base ease-ui hover:-translate-y-0.5"
	>
		{m.catalog_inquiry_cta()}
	</a>
</div>
