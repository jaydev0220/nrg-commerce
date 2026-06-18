<script lang="ts">
	import type { SimpleIcon } from 'simple-icons';

	let { icon, classList }: { icon: SimpleIcon; classList?: string } = $props();
</script>

<svg class={classList} fill="currentColor" viewBox="0 0 24 24" role="img">
	<title>{icon.title}</title>
	<path d={icon.path} />
</svg>
