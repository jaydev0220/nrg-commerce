<script lang="ts">
	import type { IconData } from './types';

	type Props = {
		classList?: string;
		icon: IconData;
	};

	let { classList = '', icon }: Props = $props();
</script>

<svg
	class={classList}
	fill="currentColor"
	viewBox="0 0 24 24"
	role="img"
>
	<title>{icon.title}</title>
	<path d={icon.path} />
</svg>
