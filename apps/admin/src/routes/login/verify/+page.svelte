<script lang="ts">
	import { KeyRound, ShieldCheck } from '@lucide/svelte';

	import { authenticateWithPasskey } from '$lib/passkey';
	import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let passkeyBusy = $state(false);
	let passkeyMessage = $state('');

	async function verifyWithPasskey() {
		passkeyBusy = true;
		passkeyMessage = '';

		try {
			const optionsResponse = await fetch('/login/verify/passkey/options', {
				method: 'POST'
			});
			const optionsPayload = (await optionsResponse.json()) as {
				ceremonyToken?: string;
				options?: unknown;
				message?: string;
			};

			if (!optionsResponse.ok || !optionsPayload.ceremonyToken || !optionsPayload.options) {
				throw new Error(optionsPayload.message ?? '無法啟動通行密鑰驗證。');
			}

			const credential = await authenticateWithPasskey(optionsPayload.options);
			const verificationResponse = await fetch('/login/verify/passkey/verify', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					ceremonyToken: optionsPayload.ceremonyToken,
					credential
				})
			});
			const verificationPayload = (await verificationResponse.json()) as {
				redirectTo?: string;
				message?: string;
			};

			if (!verificationResponse.ok || !verificationPayload.redirectTo) {
				throw new Error(verificationPayload.message ?? '通行密鑰驗證失敗。');
			}

			window.location.assign(verificationPayload.redirectTo);
		} catch (caughtError) {
			passkeyMessage = caughtError instanceof Error ? caughtError.message : '通行密鑰驗證失敗。';
		} finally {
			passkeyBusy = false;
		}
	}
</script>

<svelte:head>
	<title>登入驗證 | 管理後台</title>
</svelte:head>

<main class="grid min-h-screen place-items-center bg-bg-page px-4 py-10 text-text-body">
	<section class="w-full max-w-sm rounded-lg border border-border bg-bg-surface p-6 shadow-sm">
		<div class="mb-6 flex items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-normal text-text-heading">登入驗證</h1>
				<p class="mt-1 text-sm text-text-muted">完成第二步驗證後才能進入管理後台。</p>
			</div>
			<ThemeSwitch />
		</div>

		{#if data.method === 'authenticator'}
			<form
				method="POST"
				action="?/totp"
				class="space-y-4"
			>
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-text-heading">驗證碼</span>
					<input
						name="code"
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						value={form?.code ?? ''}
						required
						class="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-sm tracking-[0.3em] text-text-body placeholder:text-text-subtle focus:border-border-accent focus:ring-2 focus:ring-brand-muted"
					/>
				</label>

				{#if form?.message}
					<p class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
						{form.message}
					</p>
				{/if}

				<button
					type="submit"
					class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent transition hover:bg-brand-hover"
				>
					<ShieldCheck class="size-4" />
					送出驗證碼
				</button>
			</form>
		{:else}
			<div class="space-y-4">
				<p class="text-sm text-text-muted">請使用已綁定的通行密鑰完成登入驗證。</p>

				{#if passkeyMessage}
					<p class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
						{passkeyMessage}
					</p>
				{/if}

				<button
					type="button"
					class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
					disabled={passkeyBusy}
					onclick={verifyWithPasskey}
				>
					<KeyRound class="size-4" />
					{passkeyBusy ? '驗證中...' : '使用通行密鑰驗證'}
				</button>
			</div>
		{/if}
	</section>
</main>
