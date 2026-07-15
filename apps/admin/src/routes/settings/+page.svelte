<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Settings, ShieldCheck } from '@lucide/svelte';

	import type { SecurityAction } from '$lib/api/admin-api';
	import PasswordSecurityForm from '$lib/components/settings/PasswordSecurityForm.svelte';
	import PasskeySecurity from '$lib/components/settings/PasskeySecurity.svelte';
	import SecurityMfa from '$lib/components/settings/SecurityMfa.svelte';
	import SecurityReauth, {
		type SecurityReauthRequest
	} from '$lib/components/settings/SecurityReauth.svelte';
	import SessionSecurity from '$lib/components/settings/SessionSecurity.svelte';
	import type { PageData } from './$types';

	type PendingReauth = SecurityReauthRequest & {
		operation: () => Promise<void>;
	};

	let { data }: { data: PageData } = $props();
	let pendingReauth = $state<PendingReauth | null>(null);

	const currentStaff = $derived(data.currentStaff);

	function requestReauth(
		action: SecurityAction,
		targetId: string | null,
		operation: () => Promise<void>
	) {
		pendingReauth = { action, targetId, operation };
	}

	async function completeReauth() {
		const request = pendingReauth;
		pendingReauth = null;
		if (request) await request.operation();
	}

	async function refreshSettings() {
		await invalidateAll();
	}

	async function returnToLogin() {
		await goto(resolve('/login'), { invalidateAll: true });
	}
</script>

<svelte:head><title>安全設定 | 管理後台</title></svelte:head>

{#if currentStaff}
	<div class="space-y-5">
		<header class="flex flex-wrap items-start justify-between gap-4">
			<div class="flex items-start gap-3">
				<div
					class="grid size-10 shrink-0 place-items-center rounded-md bg-brand text-text-on-accent"
				>
					<Settings class="size-5" />
				</div>
				<div>
					<h1 class="text-2xl font-bold tracking-normal text-text-heading">安全設定</h1>
					<p class="mt-1 text-sm text-text-muted">管理目前帳號的密碼、驗證方式與登入工作階段。</p>
				</div>
			</div>
			<div
				class="inline-flex items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-muted"
			>
				<ShieldCheck class="size-4 text-success" />{currentStaff.email}
			</div>
		</header>

		<div class="grid gap-5 xl:grid-cols-2">
			<PasswordSecurityForm onmutated={refreshSettings} />
			<SecurityMfa
				{currentStaff}
				{requestReauth}
				onmutated={refreshSettings}
				onsessionrevoked={returnToLogin}
			/>
			<PasskeySecurity
				{currentStaff}
				passkeys={data.passkeys}
				{requestReauth}
				onmutated={refreshSettings}
				onsessionrevoked={returnToLogin}
			/>
			<SessionSecurity
				sessions={data.sessions}
				currentSessionId={data.sessionId ?? ''}
				onmutated={refreshSettings}
			/>
		</div>
	</div>

	<SecurityReauth
		request={pendingReauth}
		{currentStaff}
		onverified={completeReauth}
		oncancel={() => (pendingReauth = null)}
	/>
{/if}
