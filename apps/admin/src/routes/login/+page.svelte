<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { KeyRound } from '@lucide/svelte';

	import {
		AdminApiError,
		beginPasskeyLogin,
		completePasskeyLogin,
		loginWithPassword
	} from '$lib/api/admin-api';
	import ThemeSwitch from '$lib/components/shared/ThemeSwitch.svelte';
	import PasswordField from '$lib/components/shared/PasswordField.svelte';
	import { authenticateWithPasskey } from '$lib/passkey';

	let email = $state('');
	let message = $state(
		page.url.searchParams.get('reason') === 'session-expired' ? '登入階段已過期，請重新登入。' : ''
	);
	let busy = $state(false);
	let passkeyBusy = $state(false);
	let passkeyAvailable = $state(false);
	let conditionalAvailable = $state(false);
	let conditionalController: AbortController | null = null;

	function destination(status: string): '/' | '/login/verify' | '/login/setup' {
		if (status === 'mfa_required') return '/login/verify';
		if (status === 'mfa_setup_required') return '/login/setup';
		return '/';
	}

	function errorMessage(error: unknown): string {
		return error instanceof AdminApiError ? error.message : '登入失敗，請稍後再試。';
	}

	function isAbortError(error: unknown): boolean {
		return error instanceof DOMException && error.name === 'AbortError';
	}

	async function finishPasskey(
		options: unknown,
		mediation: CredentialMediationRequirement,
		signal?: AbortSignal
	) {
		const credential = await authenticateWithPasskey(options, mediation, signal);
		const result = await completePasskeyLogin(credential);
		await goto(resolve(destination(result.status)), { invalidateAll: true });
	}

	async function startConditionalPasskey() {
		if (!passkeyAvailable || passkeyBusy) return;
		conditionalController = new AbortController();
		try {
			const { options } = await beginPasskeyLogin();
			await finishPasskey(options, 'conditional', conditionalController.signal);
		} catch (error) {
			if (!conditionalController?.signal.aborted && !isAbortError(error))
				message = errorMessage(error);
		} finally {
			conditionalController = null;
		}
	}

	onMount(() => {
		let active = true;
		void (async () => {
			if (
				typeof window === 'undefined' ||
				!('PublicKeyCredential' in window) ||
				!navigator.credentials
			) {
				return;
			}
			passkeyAvailable = true;
			if (typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function') return;
			conditionalAvailable = await PublicKeyCredential.isConditionalMediationAvailable();
			if (active && conditionalAvailable) await startConditionalPasskey();
		})();

		return () => {
			active = false;
			conditionalController?.abort();
		};
	});

	async function submitPassword(event: SubmitEvent) {
		event.preventDefault();
		message = '';
		busy = true;
		const form = new FormData(event.currentTarget as HTMLFormElement);
		try {
			const result = await loginWithPassword({
				email: String(form.get('email') ?? ''),
				password: String(form.get('password') ?? '')
			});
			await goto(resolve(destination(result.status)), { invalidateAll: true });
		} catch (error) {
			message = errorMessage(error);
		} finally {
			busy = false;
		}
	}

	async function submitPasskey() {
		if (passkeyBusy) return;
		conditionalController?.abort();
		message = '';
		passkeyBusy = true;
		try {
			const { options } = await beginPasskeyLogin();
			await finishPasskey(options, 'optional');
		} catch (error) {
			if (!isAbortError(error)) message = errorMessage(error);
		} finally {
			passkeyBusy = false;
		}
	}
</script>

<svelte:head><title>管理後台登入</title></svelte:head>

<main class="grid min-h-screen place-items-center bg-bg-page px-4 py-10 text-text-body">
	<section class="w-full max-w-sm rounded-lg border border-border bg-bg-surface p-6 shadow-sm">
		<div class="mb-6 flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-normal text-text-heading">管理後台登入</h1>
				<p class="mt-1 text-sm text-text-muted">使用工作人員帳號繼續。</p>
			</div>
			<ThemeSwitch />
		</div>

		<form
			class="space-y-4"
			onsubmit={submitPassword}
		>
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-text-heading">電子郵件</span>
				<input
					bind:value={email}
					name="email"
					type="email"
					autocomplete="username webauthn"
					required
					aria-invalid={message ? 'true' : undefined}
					class="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-border-accent focus:ring-2 focus:ring-brand-muted"
				/>
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-text-heading">密碼</span>
				<PasswordField
					name="password"
					autocomplete="current-password"
					required
					ariaInvalid={Boolean(message)}
					inputClass="h-11 rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body placeholder:text-text-subtle focus:border-border-accent focus:ring-2 focus:ring-brand-muted"
				/>
			</label>
			{#if message}
				<p class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
					{message}
				</p>
			{/if}
			<button
				type="submit"
				disabled={busy}
				class="inline-flex h-11 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
			>
				{busy ? '登入中...' : '登入'}
			</button>
		</form>

		<div class="my-5 h-px bg-border"></div>
		<button
			type="button"
			disabled={!passkeyAvailable || passkeyBusy}
			onclick={submitPasskey}
			class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg-surface px-4 text-sm font-semibold text-text-body transition hover:border-border-strong hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-55"
		>
			<KeyRound class="size-4" />
			{passkeyBusy ? '驗證中...' : '使用通行密鑰登入'}
		</button>
	</section>
</main>
