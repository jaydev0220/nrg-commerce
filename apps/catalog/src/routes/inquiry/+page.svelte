<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { page } from '$app/state';
	import { ArrowLeft } from '@lucide/svelte';
	import InquiryForm from '$lib/components/InquiryForm.svelte';
	import { localeFromPathname } from '$lib/catalog/query.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let locale = $derived(localeFromPathname(page.url.pathname));
	let catalogHref = $derived(localizeHref('/', { locale }) as Pathname);
</script>

<main id="catalog-content">
	<section class="border-b border-border bg-bg-surface">
		<div class="mx-auto max-w-360 px-4 py-8 sm:px-6 lg:px-8">
			<a
				href={resolve(catalogHref)}
				class="duration-base inline-flex items-center gap-2 rounded-md border border-border-strong bg-bg-surface px-3 py-2 text-sm font-semibold text-text-heading shadow-xs transition-[color,background-color,border-color,transform] ease-ui hover:-translate-y-0.5 hover:border-border-accent hover:bg-brand-subtle hover:text-text-accent focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
			>
				<ArrowLeft class="size-4" />
				<span>{m.catalog_back()}</span>
			</a>
			<p class="mt-8 font-mono text-[10px] tracking-caps text-text-accent uppercase">
				{m.inquiry_eyebrow()}
			</p>
			<h1 class="mt-3 max-w-3xl text-4xl tracking-tight sm:text-5xl">{m.inquiry_title()}</h1>
			<p class="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
				{m.inquiry_description()}
			</p>
		</div>
	</section>

	<section class="mx-auto max-w-360 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
		<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
			<InquiryForm initialSkuCode={data.skuCode} />

			<aside class="rounded-lg border border-border-accent bg-bg-accent p-5">
				<h2 class="text-lg tracking-normal">{m.catalog_help_title()}</h2>
				<p class="mt-2 text-sm leading-relaxed text-text-muted">{m.catalog_help_body()}</p>
				<dl class="mt-6 space-y-4 text-sm">
					<div>
						<dt class="font-mono text-[10px] tracking-caps text-text-muted uppercase">
							{m.inquiry_email()}
						</dt>
						<dd class="mt-1 text-text-heading">{m.contact_email_value()}</dd>
					</div>
					<div>
						<dt class="font-mono text-[10px] tracking-caps text-text-muted uppercase">
							{m.inquiry_phone()}
						</dt>
						<dd class="mt-1 text-text-heading">{m.contact_phone_value()}</dd>
					</div>
				</dl>
			</aside>
		</div>
	</section>
</main>
