<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { contactItems, socialLinks, googleMapsEmbedUrl } from '$lib/data';
	import SocialIcon from '$lib/components/SocialIcon.svelte';
</script>

<!-- Desktop Layout -->
<div class="hidden lg:block">
	<div class="space-y-8">
		<!-- Contact Information -->
		<div>
			<h2 class="mb-4 text-2xl font-bold text-text-heading">
				{m.contact_info_heading()}
			</h2>
			<div class="mb-6 border-t border-border"></div>

			<div class="space-y-6">
				{#each contactItems as item (item.id)}
					{@const Icon = item.icon}
					<div class="flex items-start space-x-3">
						<Icon
							class="mt-0.5 h-5 w-5 shrink-0 text-brand"
							aria-hidden="true"
						/>
						<div class="space-y-1">
							<p class="text-xs tracking-wider text-text-muted uppercase">
								{item.label()}
							</p>
							<p class="text-sm text-text-body">
								{item.value()}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Divider -->
		<div class="border-t border-border"></div>

		<!-- Social Buttons -->
		<div class="flex space-x-3">
			{#each socialLinks as social (social.id)}
				<a
					href={social.href}
					target="_blank"
					rel="external noopener noreferrer"
					class="
						inline-flex h-9 min-w-22 items-center justify-center gap-1 rounded-md border
						border-border bg-bg-sunken px-3 py-2 text-xs font-medium text-text-body
						transition-colors duration-200 hover:-translate-y-0.5 hover:bg-bg-accent
						focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					"
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

		<!-- Google Map -->
		<div class="h-57 w-full overflow-hidden rounded-lg bg-border">
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
</div>

<!-- Tablet Layout -->
<div class="hidden md:block lg:hidden">
	<div class="mb-6 rounded-lg bg-bg-accent p-6">
		<h2 class="mb-4 text-xl font-bold text-text-heading">
			{m.contact_info_heading()}
		</h2>
		<div class="mb-4 border-t border-border"></div>

		<div class="grid grid-cols-2 gap-4">
			{#each contactItems as item (item.id)}
				{@const Icon = item.icon}
				<div class="space-y-1">
					<p class="text-xs tracking-wider text-text-muted uppercase">
						<Icon
							class="mr-1 inline-block h-4 w-4 align-middle text-brand"
							aria-hidden="true"
						/>
						{item.label()}
					</p>
					<p class="text-xs text-text-body">
						{item.value()}
					</p>
				</div>
			{/each}
		</div>

		<!-- Social Buttons -->
		<div class="mt-6 flex space-x-3">
			{#each socialLinks as social (social.id)}
				<a
					href={social.href}
					target="_blank"
					rel="external noopener noreferrer"
					class="
						inline-flex h-8 min-w-22 items-center justify-center gap-1 rounded border
						border-border bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-body
						transition-colors duration-200 hover:-translate-y-0.5 hover:bg-bg-sunken
						focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					"
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

	<!-- Google Map -->
	<div class="mb-6 h-64 w-full overflow-hidden rounded-lg bg-border">
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

<!-- Mobile Layout -->
<div class="md:hidden">
	<div class="space-y-6 bg-bg-page p-4">
		<div>
			<h2 class="mb-3 text-lg font-bold text-text-heading">
				{m.contact_info_heading()}
			</h2>
			<div class="mb-4 border-t border-border"></div>

			<div class="space-y-4">
				{#each contactItems as item (item.id)}
					{@const Icon = item.icon}
					<div class="space-y-1">
						<p class="text-xs tracking-wider text-text-muted uppercase">
							<Icon
								class="mr-1 inline-block h-4 w-4 align-middle text-brand"
								aria-hidden="true"
							/>
							{item.label()}
						</p>
						<p class="text-xs text-text-body">
							{item.value()}
						</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Social Buttons -->
		<div class="flex space-x-3">
			{#each socialLinks as social (social.id)}
				<a
					href={social.href}
					target="_blank"
					rel="external noopener noreferrer"
					class="
						inline-flex h-8 min-w-22 items-center justify-center gap-1 rounded border
						border-border bg-bg-sunken px-3 py-1.5 text-xs font-medium text-text-body
						transition-colors duration-200 hover:-translate-y-0.5 hover:bg-bg-accent
						focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					"
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

	<!-- Google Map -->
	<div class="mb-6 h-54 w-full overflow-hidden rounded-lg bg-border">
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
