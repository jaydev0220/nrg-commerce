<script lang="ts">
	type Tone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger';

	type Props = {
		children: import('svelte').Snippet;
		tone?: Tone;
	};

	let { children, tone = 'neutral' }: Props = $props();

	const toneClass = $derived(
		tone === 'accent'
			? 'border-border-accent bg-brand-subtle text-text-accent'
			: tone === 'success'
				? 'border-transparent bg-success-bg text-success'
				: tone === 'warning'
					? 'border-transparent bg-warning-bg text-warning'
					: tone === 'danger'
						? 'border-transparent bg-danger-bg text-danger'
						: 'border-border bg-bg-sunken text-text-muted'
	);
</script>

<span
	class={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass}`}
>
	{@render children()}
</span>
