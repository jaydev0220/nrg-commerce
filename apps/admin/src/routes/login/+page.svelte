<script lang="ts">
	import { KeyRound } from '@lucide/svelte';

	import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	const passkeyAvailable = false;
</script>

<svelte:head>
	<title>登入 | 管理後台</title>
</svelte:head>

<main class="grid min-h-screen place-items-center bg-bg-page px-4 py-10 text-text-body">
	<section class="w-full max-w-sm rounded-lg border border-border bg-bg-surface p-6 shadow-sm">
		<div class="mb-6 flex items-center justify-between gap-4">
			<h1 class="text-2xl font-bold tracking-normal text-text-heading">登入</h1>
			<ThemeSwitch />
		</div>

		<form
			method="POST"
			class="space-y-4"
		>
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-text-heading">帳號</span>
				<input
					name="email"
					type="email"
					value={form?.email ?? ''}
					autocomplete="username"
					required
					aria-invalid={form?.message ? 'true' : undefined}
					class="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-border-accent focus:ring-2 focus:ring-brand-muted"
				/>
			</label>

			<label class="block">
				<span class="mb-1 block text-sm font-medium text-text-heading">密碼</span>
				<input
					name="password"
					type="password"
					autocomplete="current-password"
					required
					aria-invalid={form?.message ? 'true' : undefined}
					class="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-border-accent focus:ring-2 focus:ring-brand-muted"
				/>
			</label>

			{#if form?.message}
				<p class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
					{form.message}
				</p>
			{/if}

			<button
				type="submit"
				class="inline-flex h-11 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent transition hover:bg-brand-hover"
			>
				登入
			</button>
		</form>

		<div
			class="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-caps text-text-muted"
		>
			<span class="h-px flex-1 bg-border"></span>
			或
			<span class="h-px flex-1 bg-border"></span>
		</div>

		<button
			type="button"
			disabled={!passkeyAvailable}
			class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg-surface px-4 text-sm font-semibold text-text-body transition hover:border-border-strong hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-55"
		>
			<KeyRound class="size-4" />
			通行密鑰登入
		</button>
	</section>
</main>
