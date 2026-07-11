<script lang="ts">
	import { KeyRound, ShieldCheck } from '@lucide/svelte';

	import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
	import { registerPasskey } from '$lib/passkey';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedMethod = $state<'authenticator' | 'passkey'>('authenticator');
	let passkeyBusy = $state(false);
	let passkeyMessage = $state('');
	let passkeyNickname = $state('');

	const activeMethod = $derived(form?.activeMethod ?? selectedMethod);
	const totpSetup = $derived(form?.totpSetup ?? null);

	async function setupPasskey() {
		passkeyBusy = true;
		passkeyMessage = '';
		selectedMethod = 'passkey';

		try {
			const optionsResponse = await fetch('/login/setup/passkey/options', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					nickname: passkeyNickname.trim() || undefined
				})
			});
			const optionsPayload = (await optionsResponse.json()) as {
				ceremonyToken?: string;
				options?: unknown;
				message?: string;
			};

			if (!optionsResponse.ok || !optionsPayload.ceremonyToken || !optionsPayload.options) {
				throw new Error(optionsPayload.message ?? '無法啟動通行密鑰設定。');
			}

			const credential = await registerPasskey(optionsPayload.options);
			const verificationResponse = await fetch('/login/setup/passkey/verify', {
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
				throw new Error(verificationPayload.message ?? '通行密鑰設定失敗。');
			}

			window.location.assign(verificationPayload.redirectTo);
		} catch (caughtError) {
			passkeyMessage = caughtError instanceof Error ? caughtError.message : '通行密鑰設定失敗。';
		} finally {
			passkeyBusy = false;
		}
	}
</script>

<svelte:head>
	<title>設定多重要素驗證 | 管理後台</title>
</svelte:head>

<main class="grid min-h-screen place-items-center bg-bg-page px-4 py-10 text-text-body">
	<section class="w-full max-w-xl rounded-lg border border-border bg-bg-surface p-6 shadow-sm">
		<div class="mb-6 flex items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-normal text-text-heading">設定多重要素驗證</h1>
				<p class="mt-1 text-sm text-text-muted">先綁定驗證方式，之後才能存取內部管理資料。</p>
			</div>
			<ThemeSwitch />
		</div>

		<div class="mb-5 flex flex-wrap gap-2">
			<button
				type="button"
				disabled={!data.availableMethods.includes('authenticator')}
				class={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${activeMethod === 'authenticator' ? 'border-brand bg-brand text-text-on-accent' : 'border-border bg-bg-surface text-text-body hover:bg-bg-sunken'}`}
				onclick={() => (selectedMethod = 'authenticator')}
			>
				<ShieldCheck class="size-4" />
				驗證器
			</button>
			<button
				type="button"
				disabled={!data.availableMethods.includes('passkey')}
				class={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${activeMethod === 'passkey' ? 'border-brand bg-brand text-text-on-accent' : 'border-border bg-bg-surface text-text-body hover:bg-bg-sunken'}`}
				onclick={() => (selectedMethod = 'passkey')}
			>
				<KeyRound class="size-4" />
				通行密鑰
			</button>
		</div>

		{#if activeMethod === 'authenticator'}
			<div class="space-y-4">
				{#if form?.message}
					<p class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
						{form.message}
					</p>
				{/if}

				{#if !totpSetup}
					<form
						method="POST"
						action="?/beginTotp"
					>
						<button
							type="submit"
							class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent transition hover:bg-brand-hover"
						>
							<ShieldCheck class="size-4" />
							產生驗證器設定
						</button>
					</form>
				{:else}
					<div class="rounded-lg border border-border bg-bg-sunken p-4">
						<p class="text-sm font-medium text-text-heading">手動輸入密鑰</p>
						<p class="mt-2 break-all font-mono text-sm text-text-body">{totpSetup.secret}</p>
						<p class="mt-2 text-xs text-text-muted">
							位數 {totpSetup.digits}，週期 {totpSetup.period} 秒
						</p>
					</div>

					<form
						method="POST"
						action="?/confirmTotp"
						class="space-y-4"
					>
						<input
							type="hidden"
							name="setupToken"
							value={totpSetup.setupToken}
						/>
						<input
							type="hidden"
							name="secret"
							value={totpSetup.secret}
						/>
						<input
							type="hidden"
							name="otpauthUrl"
							value={totpSetup.otpauthUrl}
						/>
						<input
							type="hidden"
							name="digits"
							value={String(totpSetup.digits)}
						/>
						<input
							type="hidden"
							name="period"
							value={String(totpSetup.period)}
						/>

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

						<button
							type="submit"
							class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent transition hover:bg-brand-hover"
						>
							<ShieldCheck class="size-4" />
							完成驗證器綁定
						</button>
					</form>
				{/if}
			</div>
		{:else}
			<div class="space-y-4">
				<p class="text-sm text-text-muted">可選填裝置名稱，方便之後辨識通行密鑰。</p>

				<label class="block">
					<span class="mb-1 block text-sm font-medium text-text-heading">裝置名稱</span>
					<input
						bind:value={passkeyNickname}
						type="text"
						placeholder="例如：工作筆電"
						class="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-border-accent focus:ring-2 focus:ring-brand-muted"
					/>
				</label>

				{#if passkeyMessage}
					<p class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
						{passkeyMessage}
					</p>
				{/if}

				<button
					type="button"
					class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
					disabled={passkeyBusy}
					onclick={setupPasskey}
				>
					<KeyRound class="size-4" />
					{passkeyBusy ? '設定中...' : '使用通行密鑰完成設定'}
				</button>
			</div>
		{/if}
	</section>
</main>
