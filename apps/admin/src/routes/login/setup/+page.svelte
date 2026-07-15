<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { KeyRound, ShieldCheck } from '@lucide/svelte';

	import {
		AdminApiError,
		beginPasskeyMfaSetup,
		beginTotpMfaSetup,
		completePasskeyMfaSetup,
		completeTotpMfaSetup
	} from '$lib/api/admin-api';
	import TotpSetupPanel from '$lib/components/settings/TotpSetupPanel.svelte';
	import ThemeSwitch from '$lib/components/shared/ThemeSwitch.svelte';
	import { registerPasskey } from '$lib/passkey';

	type TotpSetup = Awaited<ReturnType<typeof beginTotpMfaSetup>>;

	let selectedMethod = $state<'authenticator' | 'passkey'>('authenticator');
	let totpSetup = $state<TotpSetup | null>(null);
	let message = $state('');
	let busy = $state(false);
	let retrySeconds = $state(0);
	let retryTimer: ReturnType<typeof setInterval> | null = null;

	onDestroy(() => {
		if (retryTimer) clearInterval(retryTimer);
	});

	function startRetryCooldown() {
		if (retryTimer) clearInterval(retryTimer);
		retrySeconds = 5;
		retryTimer = setInterval(() => {
			retrySeconds -= 1;
			if (retrySeconds <= 0 && retryTimer) {
				clearInterval(retryTimer);
				retryTimer = null;
			}
		}, 1_000);
	}

	function setError(error: unknown, fallback: string) {
		message = error instanceof AdminApiError ? error.message : fallback;
	}

	async function beginTotp() {
		if (busy || retrySeconds > 0 || totpSetup) return;
		message = '';
		busy = true;
		try {
			totpSetup = await beginTotpMfaSetup();
		} catch (error) {
			setError(error, '無法啟動驗證器設定。');
			startRetryCooldown();
		} finally {
			busy = false;
		}
	}

	async function confirmTotp(code: string) {
		message = '';
		busy = true;
		try {
			await completeTotpMfaSetup(code);
			await goto(resolve('/'), { invalidateAll: true });
		} catch (error) {
			setError(error, '驗證器設定失敗。');
		} finally {
			busy = false;
		}
	}

	async function setupPasskey() {
		if (busy) return;
		message = '';
		busy = true;
		try {
			const { options } = await beginPasskeyMfaSetup();
			const credential = await registerPasskey(options);
			await completePasskeyMfaSetup(credential);
			await goto(resolve('/'), { invalidateAll: true });
		} catch (error) {
			setError(error, '通行密鑰設定失敗。');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>設定多重要素驗證</title></svelte:head>

<main class="grid min-h-screen place-items-center bg-bg-page px-4 py-10 text-text-body">
	<section class="w-full max-w-lg rounded-lg border border-border bg-bg-surface p-6 shadow-sm">
		<div class="mb-6 flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-normal text-text-heading">設定多重要素驗證</h1>
				<p class="mt-1 text-sm text-text-muted">首次登入必須完成一種安全驗證方式。</p>
			</div>
			<ThemeSwitch />
		</div>

		<div class="mb-5 grid grid-cols-2 gap-2">
			<button
				type="button"
				onclick={() => (selectedMethod = 'authenticator')}
				class={[
					'h-10 rounded-md border text-sm font-semibold',
					selectedMethod === 'authenticator'
						? 'border-border-accent bg-brand-muted text-text-accent'
						: 'border-border'
				]}
			>
				驗證器
			</button>
			<button
				type="button"
				onclick={() => (selectedMethod = 'passkey')}
				class={[
					'h-10 rounded-md border text-sm font-semibold',
					selectedMethod === 'passkey'
						? 'border-border-accent bg-brand-muted text-text-accent'
						: 'border-border'
				]}
			>
				通行密鑰
			</button>
		</div>

		{#if message}<p
				aria-live="polite"
				class="mb-4 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"
			>
				{message}
			</p>{/if}

		{#if selectedMethod === 'authenticator'}
			{#if !totpSetup}
				<button
					type="button"
					disabled={busy || retrySeconds > 0}
					onclick={beginTotp}
					aria-label="開始設定驗證器"
					class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:opacity-55"
				>
					<ShieldCheck class="size-4" />{busy
						? '準備中...'
						: retrySeconds > 0
							? `${retrySeconds} 秒後可重試`
							: '開始設定驗證器'}
				</button>
			{:else}
				<TotpSetupPanel
					setup={totpSetup}
					{busy}
					onconfirm={confirmTotp}
					showCancel={false}
				/>
			{/if}
		{:else}
			<button
				type="button"
				disabled={busy}
				onclick={setupPasskey}
				class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:opacity-55"
			>
				<KeyRound class="size-4" />{busy ? '設定中...' : '使用通行密鑰完成設定'}
			</button>
		{/if}
	</section>
</main>
