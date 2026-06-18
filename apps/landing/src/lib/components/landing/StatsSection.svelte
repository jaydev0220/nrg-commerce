<script lang="ts">
	import { stats } from '$lib/data';
</script>

<section class="bg-accent-700 py-10 md:py-12">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="@container">
			<div class="grid grid-cols-1 gap-4 @lg:grid-cols-3 @lg:gap-5">
				{#each stats as stat (stat.id)}
					<div
						class="rounded-xl border border-accent-600/70 bg-accent-700/80 p-4 text-center @lg:p-6"
					>
						<div class="text-2xl font-bold text-text-on-accent @lg:text-4xl">
							{stat.number()}
						</div>
						<p class="mt-2 text-xs leading-snug text-accent-200 @lg:text-sm">
							{stat.description()}
						</p>
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>
