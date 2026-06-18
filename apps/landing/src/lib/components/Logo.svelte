<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { CDN_ASSETS, cdnUrl } from '$lib/utils/cdn';

	type Props = {
		class?: string;
		width?: number;
		height?: number;
	};

	let { class: className = '', width = 108, height = 40 }: Props = $props();

	const logoLightSrc = cdnUrl(CDN_ASSETS.logoLight);
	const logoDarkSrc = cdnUrl(CDN_ASSETS.logoDark);
</script>

<img
	src={logoLightSrc}
	alt={m.company_name()}
	class={`${className} theme-logo theme-logo--light`}
	{width}
	{height}
	decoding="async"
/>
<img
	src={logoDarkSrc}
	alt={m.company_name()}
	class={`${className} theme-logo theme-logo--dark`}
	{width}
	{height}
	decoding="async"
/>

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
