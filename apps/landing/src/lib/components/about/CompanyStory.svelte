<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { splitLineBreakTags } from '$lib/utils/line-breaks';

	const storySegments = () => splitLineBreakTags(m.story_content());
</script>

<section class="bg-bg-page py-16 lg:py-20">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Section Heading -->
		<div class="mb-8 lg:mb-12">
			<h2 class="mb-4 text-3xl font-bold text-text-heading md:text-3xl lg:text-4xl">
				{m.story_heading()}
			</h2>
			<div class="border-t border-border"></div>
		</div>

		<div class="max-w-4xl space-y-4">
			<p class="text-xs leading-relaxed text-text-body lg:text-sm">
				{#each storySegments() as segment, index (index)}
					{#if segment.type === 'text'}
						{segment.value}
					{:else}
						<br />
					{/if}
				{/each}
			</p>
		</div>
	</div>
</section>
