<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';

	import type { beginSecurityTotpSetup } from '$lib/api/admin-api';

	type TotpSetup = Awaited<ReturnType<typeof beginSecurityTotpSetup>>;
	type Props = {
		setup: TotpSetup;
		busy: boolean;
		onconfirm: (code: string) => Promise<void> | void;
		oncancel?: () => void;
		showCancel?: boolean;
	};

	let { setup, busy, onconfirm, oncancel, showCancel = true }: Props = $props();
	let code = $state('');
	let qrCode = $state('');
	let message = $state('');

	onMount(() => {
		let active = true;
		void QRCode.toDataURL(setup.otpauthUrl, { width: 220, margin: 1 })
			.then((value) => {
				if (active) qrCode = value;
			})
			.catch(() => {
				if (active) qrCode = '';
			});
		return () => {
			active = false;
		};
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!/^\d{6,8}$/.test(code)) {
			message = '請輸入有效的驗證碼。';
			return;
		}
		message = '';
		await onconfirm(code);
	}
</script>

<div class="mt-4 rounded-md border border-border bg-bg-sunken p-4">
	<h3 class="text-sm font-semibold text-text-heading">設定驗證器</h3>
	<p class="mt-1 text-sm text-text-muted">使用驗證器掃描 QR Code，再輸入產生的驗證碼。</p>
	{#if qrCode}
		<img
			src={qrCode}
			alt="驗證器設定 QR Code"
			class="mx-auto mt-4 size-52 rounded-md bg-white p-2"
		/>
	{/if}
	<details class="mt-4 text-sm">
		<summary class="cursor-pointer font-medium text-text-heading">
			無法掃描？顯示手動設定密鑰
		</summary>
		<code
			class="mt-2 block rounded-md border border-border bg-bg-surface p-3 text-xs break-all text-text-body"
		>
			{setup.secret}
		</code>
	</details>
	{#if message}<p class="mt-3 text-sm text-danger">{message}</p>{/if}
	<form
		class="mt-4 space-y-3"
		onsubmit={submit}
	>
		<label class="block text-sm font-medium text-text-heading">
			驗證碼
			<input
				bind:value={code}
				inputmode="numeric"
				pattern="[0-9][0-9][0-9][0-9][0-9][0-9]([0-9][0-9])?"
				maxlength="8"
				autocomplete="one-time-code"
				required
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<div class="flex flex-wrap gap-2">
			<button
				type="submit"
				disabled={busy}
				class="h-10 cursor-pointer rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-55"
			>
				{busy ? '確認中...' : '完成設定'}
			</button>
			{#if showCancel && oncancel}
				<button
					type="button"
					disabled={busy}
					onclick={oncancel}
					class="h-10 cursor-pointer rounded-md border border-border px-4 text-sm font-semibold text-text-body hover:bg-bg-surface disabled:cursor-not-allowed disabled:opacity-55"
				>
					取消
				</button>
			{/if}
		</div>
	</form>
</div>
