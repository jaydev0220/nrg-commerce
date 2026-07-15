<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { KeyRound, ShieldCheck, Smartphone } from '@lucide/svelte';

	import {
		AdminApiError,
		beginPasskeyMfa,
		completePasskeyMfa,
		completeTotpLogin,
		type MfaMethod
	} from '$lib/api/admin-api';
	import ThemeSwitch from '$lib/components/shared/ThemeSwitch.svelte';
	import { authenticateWithPasskey } from '$lib/passkey';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let message = $state('');
	let busy = $state(false);
	let selectedMethod = $state<MfaMethod | null>(null);
	const availableMethods = $derived(
		data.authState.status === 'mfa_required' ? data.authState.availableMethods : []
	);

	$effect(() => {
		if (data.authState.status === 'mfa_required' && selectedMethod === null) {
			selectedMethod = data.authState.method;
		}
	});

	function errorMessage(error: unknown): string {
		return error instanceof AdminApiError ? error.message : '驗證失敗，請稍後再試。';
	}

	function selectMethod(method: MfaMethod) {
		message = '';
		selectedMethod = method;
		if (method === 'passkey') void submitPasskey();
	}

	async function submitTotp(event: SubmitEvent) {
		event.preventDefault();
		message = '';
		busy = true;
		const form = new FormData(event.currentTarget as HTMLFormElement);
		try {
			await completeTotpLogin(String(form.get('code') ?? ''));
			await goto(resolve('/'), { invalidateAll: true });
		} catch (error) {
			message = errorMessage(error);
		} finally {
			busy = false;
		}
	}

	async function submitPasskey() {
		if (busy) return;
		message = '';
		busy = true;
		try {
			const { options } = await beginPasskeyMfa();
			const credential = await authenticateWithPasskey(options, 'optional');
			await completePasskeyMfa(credential);
			await goto(resolve('/'), { invalidateAll: true });
		} catch (error) {
			message = errorMessage(error);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>登入驗證</title></svelte:head>

<main class="grid min-h-screen place-items-center bg-bg-page px-4 py-10 text-text-body">
	<section class="w-full max-w-md rounded-lg border border-border bg-bg-surface p-6 shadow-sm">
		<div class="mb-6 flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-normal text-text-heading">登入驗證</h1>
				<p class="mt-1 text-sm text-text-muted">選擇一種已設定的驗證方式繼續。</p>
			</div>
			<ThemeSwitch />
		</div>

		<div class="space-y-2">
			{#each availableMethods as availableMethod (availableMethod)}
				<button
					type="button"
					disabled={busy}
					class={`flex w-full cursor-pointer items-center gap-3 rounded-md border p-4 text-left transition-colors ${selectedMethod === availableMethod ? 'border-border-accent bg-brand-subtle' : 'border-border hover:border-border-strong hover:bg-bg-sunken'} disabled:cursor-not-allowed disabled:opacity-60`}
					onclick={() => selectMethod(availableMethod)}
				>
					<span
						class="grid size-10 shrink-0 place-items-center rounded-md bg-bg-surface text-text-accent"
					>
						{#if availableMethod === 'passkey'}
							<KeyRound class="size-5" />
						{:else}
							<Smartphone class="size-5" />
						{/if}
					</span>
					<span class="min-w-0">
						<strong class="block text-sm font-semibold text-text-heading">
							{availableMethod === 'passkey' ? '通行密鑰' : '驗證器'}
						</strong>
						<span class="mt-1 block text-xs text-text-muted">
							{availableMethod === 'passkey'
								? '使用已註冊的裝置驗證'
								: '輸入驗證器產生的一次性密碼'}
						</span>
					</span>
				</button>
			{/each}
		</div>

		{#if message}
			<p
				class="mt-4 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
				role="alert"
			>
				{message}
			</p>
		{/if}

		{#if selectedMethod === 'authenticator'}
			<form
				class="mt-5 space-y-4 border-t border-border pt-5"
				onsubmit={submitTotp}
			>
				<label class="block text-sm font-medium text-text-heading">
					驗證碼
					<input
						name="code"
						inputmode="numeric"
						autocomplete="one-time-code"
						pattern="[0-9][0-9][0-9][0-9][0-9][0-9]([0-9][0-9])?"
						required
						class="mt-1 h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body focus:border-border-accent focus:ring-2 focus:ring-brand-muted"
					/>
				</label>
				<button
					type="submit"
					disabled={busy}
					class="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
				>
					<ShieldCheck class="size-4" />{busy ? '驗證中...' : '驗證並登入'}
				</button>
			</form>
		{:else if selectedMethod === 'passkey'}
			<p class="mt-5 border-t border-border pt-5 text-center text-sm text-text-muted">
				{busy ? '請在裝置上完成通行密鑰驗證。' : '點選上方的通行密鑰以重新嘗試。'}
			</p>
		{/if}
	</section>
</main>
