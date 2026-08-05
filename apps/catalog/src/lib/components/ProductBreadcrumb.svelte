<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { ChevronRight } from '@lucide/svelte';

	type Props = {
		catalogHref: string;
		catalogLabel: string;
		categoryLabel: string | null;
		categoryHref?: string | null;
		productLabel: string;
	};

	let { catalogHref, catalogLabel, categoryLabel, categoryHref, productLabel }: Props = $props();
</script>

<section class="border-b border-border bg-bg-surface">
	<div class="mx-auto max-w-360 px-4 py-6 sm:px-6 lg:px-8">
		<nav
			class="flex flex-wrap items-center gap-2 text-sm text-text-muted"
			aria-label="Breadcrumb"
		>
			<a
				href={resolve(catalogHref as Pathname)}
				class="duration-base transition-[color,transform] ease-ui hover:-translate-y-0.5 hover:text-text-accent"
			>
				{catalogLabel}
			</a>
			{#if categoryLabel}
				<ChevronRight class="size-3.5" />
				{#if categoryHref}
					<a
						href={resolve(categoryHref as Pathname)}
						class="duration-base transition-[color,transform] ease-ui hover:-translate-y-0.5 hover:text-text-accent"
					>
						{categoryLabel}
					</a>
				{:else}
					<span>{categoryLabel}</span>
				{/if}
			{/if}
			<ChevronRight class="size-3.5" />
			<span class="text-text-body">{productLabel}</span>
		</nav>
	</div>
</section>
