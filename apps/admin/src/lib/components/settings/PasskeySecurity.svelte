<script lang="ts">
	import { Edit3, KeyRound, Plus, Trash2 } from '@lucide/svelte';

	import {
		AdminApiError,
		beginManagedPasskeyRegistration,
		completeManagedPasskeyRegistration,
		removeManagedPasskey,
		renameManagedPasskey,
		type CurrentStaff,
		type ManagedPasskey,
		type SecurityAction
	} from '$lib/api/admin-api';
	import { registerPasskey } from '$lib/passkey';

	type Props = {
		currentStaff: CurrentStaff;
		passkeys: ManagedPasskey[];
		requestReauth: (
			action: SecurityAction,
			targetId: string | null,
			operation: () => Promise<void>
		) => void;
		onmutated: () => Promise<void> | void;
		onsessionrevoked: () => Promise<void> | void;
	};

	let { currentStaff, passkeys, requestReauth, onmutated, onsessionrevoked }: Props = $props();
	let addOpen = $state(false);
	let newName = $state('');
	let editingId = $state<string | null>(null);
	let editingName = $state('');
	let busy = $state(false);
	let message = $state('');

	function errorMessage(error: unknown): string {
		return error instanceof AdminApiError ? error.message : '通行密鑰操作失敗。';
	}

	function startAdd() {
		message = '';
		newName = '';
		addOpen = true;
	}

	function addPasskey() {
		const nickname = newName.trim();
		if (!nickname) {
			message = '請輸入通行密鑰名稱。';
			return;
		}
		requestReauth('add_passkey', null, async () => {
			busy = true;
			try {
				const { options } = await beginManagedPasskeyRegistration(nickname);
				const credential = await registerPasskey(options);
				await completeManagedPasskeyRegistration(credential);
				addOpen = false;
				await onmutated();
			} catch (error) {
				message = errorMessage(error);
			} finally {
				busy = false;
			}
		});
	}

	function startRename(passkey: ManagedPasskey) {
		editingId = passkey.id;
		editingName = passkey.nickname ?? '';
		message = '';
	}

	function saveRename(passkeyId: string) {
		const nickname = editingName.trim();
		if (!nickname) {
			message = '請輸入通行密鑰名稱。';
			return;
		}
		requestReauth('rename_passkey', passkeyId, async () => {
			busy = true;
			try {
				await renameManagedPasskey(passkeyId, nickname);
				editingId = null;
				await onmutated();
			} catch (error) {
				message = errorMessage(error);
			} finally {
				busy = false;
			}
		});
	}

	function removePasskey(passkeyId: string) {
		if (!window.confirm('確定要移除這個通行密鑰嗎？')) return;
		requestReauth('remove_passkey', passkeyId, async () => {
			busy = true;
			try {
				await removeManagedPasskey(passkeyId);
				if (currentStaff.totpCredentialCount === 0 && passkeys.length <= 1) {
					await onsessionrevoked();
				} else {
					await onmutated();
				}
			} catch (error) {
				message = errorMessage(error);
			} finally {
				busy = false;
			}
		});
	}
</script>

<section class="rounded-lg border border-border bg-bg-surface p-5 shadow-xs">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="flex items-start gap-3">
			<div
				class="grid size-9 shrink-0 place-items-center rounded-md bg-brand-subtle text-text-accent"
			>
				<KeyRound class="size-4" />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-text-heading">通行密鑰</h2>
				<p class="mt-1 text-sm text-text-muted">新增、重新命名或移除這個帳號的登入裝置。</p>
			</div>
		</div>
		<button
			type="button"
			aria-label="新增通行密鑰"
			title="新增通行密鑰"
			onclick={startAdd}
			disabled={busy}
			class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-brand px-3 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
		>
			<Plus class="size-4" />新增通行密鑰
		</button>
	</div>

	{#if message}<p
			class="mt-4 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
		>
			{message}
		</p>{/if}

	{#if addOpen}
		<div class="mt-4 rounded-md border border-border bg-bg-sunken p-4">
			<label class="block text-sm font-medium text-text-heading">
				通行密鑰名稱
				<input
					bind:value={newName}
					maxlength="64"
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
					placeholder="例如：辦公室筆電"
				/>
			</label>
			<div class="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					aria-label="繼續設定通行密鑰"
					title="繼續設定通行密鑰"
					disabled={busy}
					onclick={addPasskey}
					class="h-10 cursor-pointer rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
				>
					{busy ? '設定中...' : '繼續設定'}
				</button>
				<button
					type="button"
					aria-label="取消新增通行密鑰"
					title="取消新增通行密鑰"
					disabled={busy}
					onclick={() => (addOpen = false)}
					class="h-10 cursor-pointer rounded-md border border-border px-4 text-sm font-semibold text-text-body hover:bg-bg-surface disabled:cursor-not-allowed disabled:opacity-55"
				>
					取消
				</button>
			</div>
		</div>
	{/if}

	{#if passkeys.length === 0}
		<p class="mt-5 text-sm text-text-muted">尚未設定通行密鑰。</p>
	{:else}
		<ul class="mt-5 divide-y divide-border">
			{#each passkeys as passkey (passkey.id)}
				<li class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
					{#if editingId === passkey.id}
						<div class="min-w-0 flex-1">
							<input
								bind:value={editingName}
								maxlength="64"
								class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
							/>
						</div>
						<div class="flex shrink-0 gap-2">
							<button
								type="button"
								aria-label="儲存通行密鑰名稱"
								title="儲存通行密鑰名稱"
								disabled={busy}
								onclick={() => saveRename(passkey.id)}
								class="h-9 cursor-pointer rounded-md bg-brand px-3 text-sm font-semibold text-text-on-accent disabled:cursor-not-allowed disabled:opacity-55"
							>
								儲存
							</button>
							<button
								type="button"
								aria-label="取消重新命名"
								title="取消重新命名"
								disabled={busy}
								onclick={() => (editingId = null)}
								class="h-9 cursor-pointer rounded-md border border-border px-3 text-sm font-semibold text-text-body disabled:cursor-not-allowed disabled:opacity-55"
							>
								取消
							</button>
						</div>
					{:else}
						<div class="min-w-0">
							<p class="truncate text-sm font-semibold text-text-heading">
								{passkey.nickname ?? '未命名通行密鑰'}
							</p>
							<p class="mt-1 text-xs text-text-muted">
								{passkey.deviceType === 'multiDevice' ? '可同步裝置' : '單一裝置'}
								{passkey.lastUsedAt
									? ` · 最近使用 ${passkey.lastUsedAt.toLocaleDateString('zh-TW')}`
									: ''}
							</p>
						</div>
						<div class="flex shrink-0 gap-2">
							<button
								type="button"
								aria-label="重新命名通行密鑰"
								title="重新命名通行密鑰"
								disabled={busy}
								onclick={() => startRename(passkey)}
								class="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-sm font-semibold text-text-body hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-55"
							>
								<Edit3 class="size-4" />重新命名
							</button>
							<button
								type="button"
								aria-label="移除通行密鑰"
								title="移除通行密鑰"
								disabled={busy || (currentStaff.totpCredentialCount === 0 && passkeys.length <= 1)}
								onclick={() => removePasskey(passkey.id)}
								class="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-danger/30 px-3 text-sm font-semibold text-danger hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-55"
							>
								<Trash2 class="size-4" />移除
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
