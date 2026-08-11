<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { contactItems, socialLinks, googleMapsEmbedUrl } from '$lib/data';
	import { SocialIcon } from '@packages/components';
</script>

<div class="space-y-6 md:space-y-0 lg:space-y-8">
	<div class="rounded-lg bg-bg-page p-4 md:bg-bg-accent md:p-6 lg:bg-transparent lg:p-0">
		<h2 class="mb-3 text-lg font-bold text-text-heading md:mb-4 md:text-xl lg:text-2xl">
			{m.contact_info_heading()}
		</h2>
		<div class="mb-4 border-t border-border lg:mb-6"></div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-1 lg:gap-6">
			{#each contactItems as item (item.id)}
				{@const Icon = item.icon}
				<div class="flex items-start gap-2 lg:gap-3">
					<Icon
						class="mt-0.5 size-4 shrink-0 text-brand lg:size-5"
						aria-hidden="true"
					/>
					<div class="space-y-1">
						<p class="text-xs tracking-wider text-text-body uppercase">
							{item.label()}
						</p>
						<p class="text-xs text-text-body lg:text-sm">
							{item.value()}
						</p>
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-6 border-t border-border pt-6 lg:mt-8">
			<div class="flex flex-wrap gap-3">
				{#each socialLinks as social (social.id)}
					<a
						href={social.href}
						target="_blank"
						rel="external noopener noreferrer"
						class="inline-flex h-8 min-w-22 items-center justify-center gap-1 rounded border border-border bg-bg-sunken px-3 py-1.5 text-xs font-medium text-text-body transition-colors duration-200 hover:-translate-y-0.5 hover:bg-bg-accent focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none lg:h-9 lg:rounded-md lg:py-2"
						aria-label={social.label()}
					>
						<SocialIcon
							icon={social.icon}
							classList="h-4 w-auto"
						/>
						{social.label()}
					</a>
				{/each}
			</div>
		</div>
	</div>

	<div class="h-54 w-full overflow-hidden rounded-lg bg-border md:mt-6 md:h-64 lg:mt-0 lg:h-57">
		<iframe
			title="Map"
			src={googleMapsEmbedUrl}
			width="100%"
			height="100%"
			allowfullscreen={true}
			loading="lazy"
			referrerpolicy="no-referrer-when-downgrade"
		></iframe>
	</div>
</div>
