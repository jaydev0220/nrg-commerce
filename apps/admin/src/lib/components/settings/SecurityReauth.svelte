<script lang="ts">
	import { KeyRound, ShieldCheck, X } from '@lucide/svelte';

	import {
		AdminApiError,
		beginSecurityPasskeyReauth,
		completeSecurityPasskeyReauth,
		verifySecurityPassword,
		verifySecurityTotp,
		type CurrentStaff,
		type SecurityAction,
		type SecurityReauthMethod
	} from '$lib/api/admin-api';
	import { authenticateWithPasskey } from '$lib/passkey';
	import PasswordField from '$lib/components/shared/PasswordField.svelte';

	export type SecurityReauthRequest = {
		action: SecurityAction;
		targetId?: string | null;
	};

	type Props = {
		request: SecurityReauthRequest | null;
		currentStaff: Pick<CurrentStaff, 'totpCredentialCount' | 'passkeyCredentialCount'>;
		onverified: () => Promise<void> | void;
		oncancel: () => void;
	};

	let { request, currentStaff, onverified, oncancel }: Props = $props();
	let method = $state<SecurityReauthMethod>('password');
	let password = $state('');
	let code = $state('');
	let message = $state('');
	let busy = $state(false);

	const availableMethods = $derived.by(() => {
		const methods: SecurityReauthMethod[] = [];
		if (currentStaff.totpCredentialCount > 0) methods.push('authenticator');
		if (currentStaff.passkeyCredentialCount > 0) methods.push('passkey');
		if (methods.length === 0) methods.push('password');
		return methods;
	});

	const actionLabels: Record<SecurityAction, string> = {
		add_totp: '新增驗證器',
		remove_totp: '移除驗證器',
		add_passkey: '新增通行密鑰',
		rename_passkey: '重新命名通行密鑰',
		remove_passkey: '移除通行密鑰'
	};

	const methodLabels: Record<SecurityReauthMethod, string> = {
		password: '目前密碼',
		authenticator: '驗證器',
		passkey: '通行密鑰'
	};

	$effect(() => {
		if (!request) return;
		method = availableMethods[0] ?? 'password';
		password = '';
		code = '';
		message = '';
	});

	function errorMessage(error: unknown): string {
		return error instanceof AdminApiError ? error.message : '安全驗證失敗，請稍後再試。';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!request || busy) return;
		busy = true;
		message = '';
		try {
			if (method === 'password') {
				await verifySecurityPassword({
					action: request.action,
					targetId: request.targetId,
					password
				});
			} else if (method === 'authenticator') {
				await verifySecurityTotp({
					action: request.action,
					targetId: request.targetId,
					code
				});
			} else {
				const { options } = await beginSecurityPasskeyReauth({
					action: request.action,
					targetId: request.targetId
				});
				const credential = await authenticateWithPasskey(options, 'required');
				await completeSecurityPasskeyReauth(credential);
			}
			await onverified();
		} catch (error) {
			message = errorMessage(error);
		} finally {
			busy = false;
		}
	}
</script>

{#if request}
	<div class="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4">
		<div
			class="w-full max-w-md rounded-lg border border-border bg-bg-surface p-5 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="security-reauth-title"
		>
			<header class="flex items-start justify-between gap-4">
				<div>
					<p class="text-xs font-semibold tracking-caps text-text-muted uppercase">安全驗證</p>
					<h2
						id="security-reauth-title"
						class="mt-1 text-lg font-semibold text-text-heading"
					>
						{actionLabels[request.action]}
					</h2>
				</div>
				<button
					type="button"
					class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border text-text-muted hover:bg-bg-sunken"
					onclick={oncancel}
					aria-label="關閉安全驗證"
				>
					<X class="size-4" />
				</button>
			</header>

			{#if availableMethods.length > 1}
				<label class="mt-5 block text-sm font-medium text-text-heading">
					驗證方式
					<select
						bind:value={method}
						class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
					>
						{#each availableMethods as availableMethod (availableMethod)}
							<option value={availableMethod}>{methodLabels[availableMethod]}</option>
						{/each}
					</select>
				</label>
			{:else}
				<p class="mt-4 text-sm text-text-muted">使用「{methodLabels[method]}」確認這項操作。</p>
			{/if}

			{#if message}
				<p
					class="mt-4 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
				>
					{message}
				</p>
			{/if}

			{#if method === 'passkey'}
				<button
					type="button"
					disabled={busy}
					onclick={() => submit(new SubmitEvent('submit'))}
					class="mt-5 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
				>
					<KeyRound class="size-4" />
					{busy ? '驗證中...' : '使用通行密鑰驗證'}
				</button>
			{:else}
				<form
					class="mt-5 space-y-4"
					onsubmit={submit}
				>
					{#if method === 'password'}
						<label class="block text-sm font-medium text-text-heading">
							目前密碼
							<PasswordField
								bind:value={password}
								name="security-password"
								autocomplete="current-password"
								required
								inputClass="mt-1 h-10 rounded-md border border-border bg-bg-surface px-3"
							/>
						</label>
					{:else}
						<label class="block text-sm font-medium text-text-heading">
							驗證碼
							<input
								bind:value={code}
								type="text"
								inputmode="numeric"
								autocomplete="one-time-code"
								required
								class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
							/>
						</label>
					{/if}
					<button
						type="submit"
						disabled={busy}
						class="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
					>
						<ShieldCheck class="size-4" />
						{busy ? '驗證中...' : '確認操作'}
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}
