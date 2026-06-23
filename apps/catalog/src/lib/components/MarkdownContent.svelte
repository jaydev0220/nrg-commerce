<script lang="ts">
	import { renderMarkdown } from '$lib/catalog/markdown.js';

	type Props = {
		source?: string | null;
	};

	let { source = '' }: Props = $props();
</script>

<div
	class="mt-4 space-y-4 text-base leading-normal text-text-body [&_a]:wrap-break-word [&_blockquote]:border-l-2 [&_blockquote]:border-border-accent [&_blockquote]:pl-4 [&_blockquote]:text-text-muted [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:tracking-normal [&_h4]:mt-6 [&_h4]:text-lg [&_hr]:my-7 [&_hr]:border-border [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:max-w-3xl [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-bg-sunken [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html renderMarkdown(source)}
</div>
