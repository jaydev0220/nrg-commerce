<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import * as m from '$lib/paraglide/messages';
	import { extractLocaleFromUrl, localizeHref } from '$lib/paraglide/runtime';
	import type { SupportedLocale } from '@packages/seo';

	const locale = $derived(extractLocaleFromUrl(page.url) as SupportedLocale);
</script>

<section class="bg-bg-page py-16 lg:py-20">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<h2 class="text-3xl font-bold text-text-heading lg:text-4xl">{m.story_heading()}</h2>
		<div class="mt-8 grid max-w-5xl gap-8 md:grid-cols-3">
			<section aria-labelledby="story-identity">
				<h3
					id="story-identity"
					class="text-xl font-bold text-text-heading"
				>
					{m.story_identity_heading()}
				</h3>
				<p class="mt-3 leading-relaxed text-text-body">{m.story_identity()}</p>
			</section>
			<section aria-labelledby="story-history">
				<h3
					id="story-history"
					class="text-xl font-bold text-text-heading"
				>
					{m.story_history_heading()}
				</h3>
				<p class="mt-3 leading-relaxed text-text-body">{m.story_history()}</p>
			</section>
			<section aria-labelledby="story-services">
				<h3
					id="story-services"
					class="text-xl font-bold text-text-heading"
				>
					{m.story_services_heading()}
				</h3>
				<p class="mt-3 leading-relaxed text-text-body">{m.story_services()}</p>
			</section>
		</div>
		<a
			href={resolve(localizeHref('/capabilities/', { locale }) as Pathname)}
			class="mt-8 inline-flex min-h-11 items-center rounded-md bg-brand px-6 py-3 font-medium text-text-on-accent hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
		>
			{m.story_capabilities_cta()}
		</a>
	</div>
</section>
