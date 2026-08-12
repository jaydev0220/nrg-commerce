<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import * as m from '$lib/paraglide/messages';
</script>

<PageHeader
	breadcrumb={m.breadcrumb_privacy()}
	title={m.privacy_page_title()}
/>

<section class="bg-bg-page py-16 lg:py-20">
	<div class="mx-auto max-w-4xl space-y-10 px-4 sm:px-6 lg:px-8">
		<p class="text-lg leading-relaxed text-text-body">{m.privacy_intro()}</p>
		<section aria-labelledby="privacy-purpose">
			<h2
				id="privacy-purpose"
				class="text-2xl font-bold text-text-heading"
			>
				{m.privacy_purpose_heading()}
			</h2>
			<p class="mt-3 leading-relaxed text-text-body">{m.privacy_purpose()}</p>
		</section>
		<section aria-labelledby="privacy-processors">
			<h2
				id="privacy-processors"
				class="text-2xl font-bold text-text-heading"
			>
				{m.privacy_processors_heading()}
			</h2>
			<p class="mt-3 leading-relaxed text-text-body">{m.privacy_processors()}</p>
		</section>
		<section aria-labelledby="privacy-maps">
			<h2
				id="privacy-maps"
				class="text-2xl font-bold text-text-heading"
			>
				{m.privacy_maps_heading()}
			</h2>
			<p class="mt-3 leading-relaxed text-text-body">{m.privacy_maps()}</p>
		</section>
		<section aria-labelledby="privacy-retention">
			<h2
				id="privacy-retention"
				class="text-2xl font-bold text-text-heading"
			>
				{m.privacy_retention_heading()}
			</h2>
			<p class="mt-3 leading-relaxed text-text-body">{m.privacy_retention()}</p>
		</section>
		<section aria-labelledby="privacy-rights">
			<h2
				id="privacy-rights"
				class="text-2xl font-bold text-text-heading"
			>
				{m.privacy_rights_heading()}
			</h2>
			<p class="mt-3 leading-relaxed text-text-body">{m.privacy_rights()}</p>
		</section>
	</div>
</section>
