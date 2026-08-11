<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { page } from '$app/state';
	import { localizeHref } from '$lib/paraglide/runtime';
</script>

<svelte:head>
	<title>找不到頁面 | Page not found | NRG Labware</title>
	<meta
		name="description"
		content="找不到您要查看的頁面。請返回首頁或選擇其他網站內容。 The requested page could not be found. Return home or choose another page."
	/>
</svelte:head>

<section
	id="error-content"
	aria-labelledby="error-title"
	class="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-20 text-center"
>
	<p class="font-mono text-sm tracking-[0.16em] text-text-muted">{page.status}</p>
	<h1
		id="error-title"
		class="mt-4 text-3xl text-text-heading sm:text-4xl"
	>
		找不到頁面 <span aria-hidden="true">|</span>
		Page not found
	</h1>
	<p class="mt-4 max-w-2xl text-text-muted">
		<span lang="zh-TW">找不到您要查看的頁面，請返回首頁或選擇其他內容。</span>
		<span aria-hidden="true"></span>
		<span lang="en">
			The requested page could not be found. Return home or choose another page.
		</span>
	</p>
	<nav
		class="mt-8 flex flex-wrap justify-center gap-3"
		aria-label="Error recovery links"
	>
		<a
			class="hover:bg-brand-strong rounded-md bg-brand px-5 py-3 text-sm font-semibold text-text-on-accent transition-colors"
			href={resolve('/')}
		>
			<span lang="zh-TW">回到首頁</span>
			<span aria-hidden="true">/</span>
			<span lang="en">Home</span>
		</a>
		<a
			class="rounded-md border border-border bg-bg-surface px-5 py-3 text-sm font-semibold text-text-body transition-colors hover:border-border-accent hover:bg-bg-accent"
			href={resolve(localizeHref('/', { locale: 'en' }) as Pathname)}
		>
			English home
		</a>
		<a
			class="rounded-md border border-border bg-bg-surface px-5 py-3 text-sm font-semibold text-text-body transition-colors hover:border-border-accent hover:bg-bg-accent"
			href={resolve('/contact/')}
		>
			<span lang="zh-TW">聯絡我們</span>
			<span aria-hidden="true">/</span>
			<span lang="en">Contact</span>
		</a>
	</nav>
</section>
