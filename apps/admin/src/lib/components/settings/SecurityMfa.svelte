<script lang="ts">
	import { Plus, ShieldCheck, Trash2 } from '@lucide/svelte';

	import {
		AdminApiError,
		beginSecurityTotpSetup,
		completeSecurityTotpSetup,
		removeSecurityTotp,
		updateMfaPreference,
		type CurrentStaff,
		type SecurityAction
	} from '$lib/api/admin-api';
	import TotpSetupPanel from './TotpSetupPanel.svelte';

	type TotpSetup = Awaited<ReturnType<typeof beginSecurityTotpSetup>>;
	type Props = {
		currentStaff: CurrentStaff;
		requestReauth: (
			action: SecurityAction,
			targetId: string | null,
			operation: () => Promise<void>
		) => void;
		onmutated: () => Promise<void> | void;
		onsessionrevoked: () => Promise<void> | void;
	};

	let { currentStaff, requestReauth, onmutated, onsessionrevoked }: Props = $props();
	let totpSetup = $state<TotpSetup | null>(null);
	let preferredMfaMethod = $derived(
		currentStaff.preferredMfaMethod ??
			(currentStaff.totpCredentialCount > 0
				? 'authenticator'
				: currentStaff.passkeyCredentialCount > 0
					? 'passkey'
					: null)
	);
	let busy = $state(false);
	let message = $state('');

	function errorMessage(error: unknown): string {
		return error instanceof AdminApiError ? error.message : '安全設定更新失敗。';
	}

	function startTotpSetup() {
		message = '';
		requestReauth('add_totp', null, async () => {
			try {
				totpSetup = await beginSecurityTotpSetup();
			} catch (error) {
				message = errorMessage(error);
			}
		});
	}

	async function confirmTotp(code: string) {
		busy = true;
		message = '';
		try {
			await completeSecurityTotpSetup(code);
			totpSetup = null;
			await onmutated();
		} catch (error) {
			message = errorMessage(error);
		} finally {
			busy = false;
		}
	}

	function removeTotp() {
		message = '';
		requestReauth('remove_totp', null, async () => {
			busy = true;
			try {
				await removeSecurityTotp();
				if (currentStaff.passkeyCredentialCount === 0) await onsessionrevoked();
				else await onmutated();
			} catch (error) {
				message = errorMessage(error);
			} finally {
				busy = false;
			}
		});
	}

	async function savePreference() {
		if (!preferredMfaMethod) {
			message = '請先設定一種驗證方式。';
			return;
		}
		message = '';
		busy = true;
		try {
			await updateMfaPreference({ preferredMfaMethod });
			await onmutated();
		} catch (error) {
			message = errorMessage(error);
		} finally {
			busy = false;
		}
	}
</script>

<section class="rounded-lg border border-border bg-bg-surface p-5 shadow-xs">
	<div class="flex items-start gap-3">
		<div
			class="grid size-9 shrink-0 place-items-center rounded-md bg-brand-subtle text-text-accent"
		>
			<ShieldCheck class="size-4" />
		</div>
		<div>
			<h2 class="text-lg font-semibold text-text-heading">多重要素驗證</h2>
			<p class="mt-1 text-sm text-text-muted">管理登入要求與目前已設定的驗證器。</p>
		</div>
	</div>

	{#if message}<p
			class="mt-4 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
		>
			{message}
		</p>{/if}

	<div class="mt-5 border-b border-border pb-4">
		<div>
			<p class="text-sm font-semibold text-text-heading">登入時強制使用多重要素驗證</p>
			<p class="mt-1 text-xs text-text-muted">所有工作人員都必須設定至少一種驗證方式。</p>
		</div>
	</div>

	<label class="mt-4 block text-sm font-medium text-text-heading">
		偏好的驗證方式
		<select
			bind:value={preferredMfaMethod}
			disabled={currentStaff.totpCredentialCount === 0 && currentStaff.passkeyCredentialCount === 0}
			class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3 disabled:bg-bg-sunken"
		>
			{#if currentStaff.totpCredentialCount > 0}<option value="authenticator">驗證器</option>{/if}
			{#if currentStaff.passkeyCredentialCount > 0}<option value="passkey">通行密鑰</option>{/if}
		</select>
	</label>
	<button
		type="button"
		disabled={busy || !preferredMfaMethod}
		onclick={savePreference}
		class="mt-3 h-10 cursor-pointer rounded-md border border-border px-4 text-sm font-semibold text-text-body hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-55"
	>
		儲存登入偏好
	</button>

	<div class="mt-5 space-y-3">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="text-sm font-semibold text-text-heading">驗證器</p>
				<p class="mt-1 text-xs text-text-muted">
					{currentStaff.totpCredentialCount > 0 ? '已設定' : '尚未設定'}
				</p>
			</div>
			{#if currentStaff.totpCredentialCount > 0}
				<button
					type="button"
					aria-label="移除驗證器"
					title="移除驗證器"
					disabled={busy ||
						currentStaff.totpCredentialCount + currentStaff.passkeyCredentialCount <= 1}
					onclick={removeTotp}
					class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-danger/30 px-3 text-sm font-semibold text-danger hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-55"
				>
					<Trash2 class="size-4" />移除驗證器
				</button>
			{:else}
				<button
					type="button"
					aria-label="新增驗證器"
					title="新增驗證器"
					disabled={busy}
					onclick={startTotpSetup}
					class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-brand px-3 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
				>
					<Plus class="size-4" />新增驗證器
				</button>
			{/if}
		</div>
		{#if totpSetup}
			<TotpSetupPanel
				setup={totpSetup}
				{busy}
				onconfirm={confirmTotp}
				oncancel={() => (totpSetup = null)}
			/>
		{/if}
	</div>
</section>
