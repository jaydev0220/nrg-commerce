<script lang="ts">
	type Props = {
		source?: string | null;
	};

	let { source = '' }: Props = $props();
</script>

<p class="mt-4 max-w-3xl text-base leading-normal whitespace-pre-line text-text-body">{source}</p>
