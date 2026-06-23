<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { partnerships } from '$lib/data';
</script>

<section class="bg-bg-accent py-16 lg:py-20">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Section Heading -->
		<div class="mb-8 lg:mb-12">
			<h2 class="text-3xl font-bold text-text-heading lg:text-4xl">
				{m.partnership_heading()}
			</h2>
		</div>

		<!-- Desktop Layout (Side by Side) -->
		<div class="hidden grid-cols-1 gap-8 lg:grid">
			{#each partnerships as partnership (partnership.id)}
				<div class="flex h-46 flex-col justify-between rounded-xl bg-bg-surface p-8">
					<div class="space-y-3">
						<h3 class="text-xl font-bold text-text-heading">
							{partnership.title()}
						</h3>
						<p class="text-sm leading-relaxed text-text-body">
							{partnership.description()}
						</p>
					</div>
					<div>
						<a
							href={resolve(partnership.href)}
							class="
								inline-flex h-9 w-37 items-center justify-center rounded px-6 py-2 text-sm
								font-medium transition-colors duration-200 hover:-translate-y-0.5
								focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none
								{partnership.primary
								? 'bg-brand text-text-on-accent hover:bg-brand-hover focus-visible:ring-brand'
								: 'border border-border bg-bg-surface text-text-body hover:bg-bg-accent focus-visible:ring-brand'}
							"
						>
							{partnership.cta()}
						</a>
					</div>
				</div>
			{/each}
		</div>

		<!-- Tablet Layout (Stacked) -->
		<div class="hidden space-y-6 md:block lg:hidden">
			{#each partnerships as partnership (partnership.id)}
				<div class="flex h-44 flex-col justify-between rounded-xl bg-bg-surface p-6">
					<div class="space-y-2">
						<h3 class="text-lg font-bold text-text-heading">
							{partnership.title()}
						</h3>
						<p class="text-sm leading-relaxed text-text-body">
							{partnership.description()}
						</p>
					</div>
					<div>
						<a
							href={resolve(partnership.href)}
							class="
								inline-flex h-9 w-37 items-center justify-center rounded px-6 py-2 text-sm
								font-medium transition-colors duration-200 hover:-translate-y-0.5
								focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none
								{partnership.primary
								? 'bg-brand text-text-on-accent hover:bg-brand-hover focus-visible:ring-brand'
								: 'border border-border bg-bg-surface text-text-body hover:bg-bg-accent focus-visible:ring-brand'}
							"
						>
							{partnership.cta()}
						</a>
					</div>
				</div>
			{/each}
		</div>

		<!-- Mobile Layout (Stacked) -->
		<div class="space-y-6 md:hidden">
			{#each partnerships as partnership (partnership.id)}
				<div class="flex h-44 flex-col justify-between rounded-xl bg-bg-surface p-6">
					<div class="space-y-2">
						<h3 class="text-base font-bold text-text-heading">
							{partnership.title()}
						</h3>
						<p class="text-sm leading-relaxed text-text-body">
							{partnership.description()}
						</p>
					</div>
					<div>
						<a
							href={resolve(partnership.href)}
							class="
								block w-full rounded px-6 py-3 text-center text-sm
								font-medium transition-colors duration-200 hover:-translate-y-0.5
								focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none
								{partnership.primary
								? 'bg-brand text-text-on-accent hover:bg-brand-hover focus-visible:ring-brand'
								: 'border border-border bg-bg-surface text-text-body hover:bg-bg-accent focus-visible:ring-brand'}
							"
						>
							{partnership.cta()}
						</a>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	section {
		--ease-ui: cubic-bezier(0.4, 0, 0.2, 1);
		--duration-base: 180ms;
	}
</style>
