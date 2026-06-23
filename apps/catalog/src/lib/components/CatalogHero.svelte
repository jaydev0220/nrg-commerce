<script lang="ts">
	type Props = {
		title: string;
		description: string;
		eyebrow: string;
		homeLabel: string;
	};

	let { title, description, eyebrow, homeLabel }: Props = $props();
</script>

<section class="border-b border-border bg-bg-surface">
	<div class="mx-auto max-w-360 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
		<nav
			class="mb-6 flex items-center gap-2 text-sm text-text-muted"
			aria-label="Breadcrumb"
		>
			<span>{homeLabel}</span>
			<span aria-hidden="true">/</span>
			<span class="text-text-body">{title}</span>
		</nav>
		<div class="max-w-3xl">
			<div class="mb-4 flex items-center gap-3">
				<span class="font-mono text-xs font-semibold tracking-caps text-text-accent">
					{eyebrow}
				</span>
				<span class="h-px w-12 bg-border-strong"></span>
			</div>
			<h1 class="text-4xl tracking-tight sm:text-5xl">{title}</h1>
			<p class="mt-5 max-w-2xl text-base text-text-muted sm:text-lg">{description}</p>
		</div>
	</div>
</section>
