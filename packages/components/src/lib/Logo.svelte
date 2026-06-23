<script lang="ts">
	import type { LogoConfig } from './types';

	type Props = LogoConfig;

	let { alt, class: className = '', darkSrc, lightSrc, height = 40, width = 108 }: Props = $props();
</script>

<img
	src={lightSrc}
	{alt}
	class={`${className} theme-logo theme-logo--light`}
	{width}
	{height}
	decoding="async"
/>

{#if darkSrc}
	<img
		src={darkSrc}
		{alt}
		class={`${className} theme-logo theme-logo--dark`}
		{width}
		{height}
		decoding="async"
	/>
{/if}

<style>
	.theme-logo--dark {
		display: none;
	}

	:global(html.dark) .theme-logo--light {
		display: none;
	}

	:global(html.dark) .theme-logo--dark {
		display: inline-block;
	}
</style>
