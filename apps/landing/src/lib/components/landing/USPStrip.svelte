<script lang="ts">
	import { usps } from '$lib/data';
	import * as m from '$lib/paraglide/messages';
</script>

<section class="border-y border-border bg-bg-page py-10">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<h2 class="mb-6 text-2xl font-bold text-text-heading">{m.procurement_heading()}</h2>
		<div class="@container">
			<div class="grid grid-cols-1 gap-4 @md:grid-cols-2">
				{#each usps as usp (usp.id)}
					{@const Icon = usp.icon}
					<article class="rounded-xl border border-border bg-bg-surface p-5 text-center">
						<div
							class="flex justify-center"
							aria-hidden="true"
						>
							<Icon class="h-7 w-7 text-brand" />
						</div>
						<h3 class="mt-2 font-semibold text-text-heading">
							{usp.title()}
						</h3>
						<p class="mt-2 text-sm text-text-body">
							{usp.description()}
						</p>
					</article>
				{/each}
			</div>
		</div>
	</div>
</section>
