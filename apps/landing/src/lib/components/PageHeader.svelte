<script lang="ts">
	let { breadcrumb, title } = $props<{
		breadcrumb: string;
		title: string;
	}>();
</script>

<section class="flex h-50 items-center bg-bg-accent">
	<div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="space-y-2">
			<p class="text-xs tracking-wider text-text-muted uppercase">
				{breadcrumb}
			</p>
			<h1 class="text-4xl font-bold text-text-heading md:text-4xl lg:text-5xl xl:text-5xl">
				{title}
			</h1>
		</div>
	</div>
</section>
