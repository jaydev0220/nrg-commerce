<script lang="ts">
	import { Check, KeyRound } from '@lucide/svelte';
	import { strongPasswordSchema } from '@packages/schemas';

	import { AdminApiError, changeCurrentPassword } from '$lib/api/admin-api';
	import PasswordField from '$lib/components/shared/PasswordField.svelte';

	type Props = {
		onmutated: () => Promise<void> | void;
	};

	let { onmutated }: Props = $props();
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmation = $state('');
	let message = $state('');
	let success = $state('');
	let busy = $state(false);

	function errorMessage(error: unknown): string {
		return error instanceof AdminApiError ? error.message : '密碼更新失敗，請稍後再試。';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		message = '';
		success = '';
		if (newPassword !== confirmation) {
			message = '兩次輸入的新密碼不一致。';
			return;
		}
		if (!strongPasswordSchema.safeParse(newPassword).success) {
			message = '新密碼須至少 17 個字元，並包含大小寫英文字母、數字與符號。';
			return;
		}
		busy = true;
		try {
			await changeCurrentPassword({ currentPassword, newPassword });
			currentPassword = '';
			newPassword = '';
			confirmation = '';
			success = '密碼已更新，其他登入工作階段已登出。';
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
			<KeyRound class="size-4" />
		</div>
		<div>
			<h2 class="text-lg font-semibold text-text-heading">變更密碼</h2>
			<p class="mt-1 text-sm text-text-muted">變更後會保留目前登入，其他工作階段會被撤銷。</p>
		</div>
	</div>

	{#if message}<p
			class="mt-4 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
		>
			{message}
		</p>{/if}
	{#if success}
		<p class="mt-4 inline-flex items-center gap-2 text-sm text-success">
			<Check class="size-4" />{success}
		</p>
	{/if}

	<form
		class="mt-5 grid gap-4"
		onsubmit={submit}
	>
		<label class="text-sm font-medium text-text-heading">
			目前密碼
			<PasswordField
				bind:value={currentPassword}
				name="current-password"
				autocomplete="current-password"
				required
				inputClass="mt-1 h-10 rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="text-sm font-medium text-text-heading">
				新密碼
				<PasswordField
					bind:value={newPassword}
					name="new-password"
					autocomplete="new-password"
					required
					inputClass="mt-1 h-10 rounded-md border border-border bg-bg-surface px-3"
				/>
			</label>
			<label class="text-sm font-medium text-text-heading">
				確認新密碼
				<PasswordField
					bind:value={confirmation}
					name="new-password-confirmation"
					autocomplete="new-password"
					required
					inputClass="mt-1 h-10 rounded-md border border-border bg-bg-surface px-3"
				/>
			</label>
		</div>
		<button
			type="submit"
			disabled={busy}
			class="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55 sm:w-fit"
		>
			{busy ? '更新中...' : '更新密碼'}
		</button>
	</form>
</section>
