<script lang="ts">
	type Props = {
		title: string;
		message?: string;
	};

	let { title, message }: Props = $props();
</script>

<div
	class="rounded-lg border border-dashed border-border-strong bg-bg-surface px-6 py-10 text-center"
	role="status"
>
	<h2 class="text-lg font-semibold tracking-normal text-text-heading">{title}</h2>
	{#if message}
		<p class="mx-auto mt-2 max-w-xl text-sm text-text-muted">{message}</p>
	{/if}
</div>
