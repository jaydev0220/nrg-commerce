<script lang="ts">
	import { LogOut, MonitorSmartphone } from '@lucide/svelte';

	import {
		AdminApiError,
		formatDateTime,
		revokeAuthSession,
		revokeOtherAuthSessions,
		type ManagedAuthSession
	} from '$lib/api/admin-api';

	type Props = {
		sessions: ManagedAuthSession[];
		currentSessionId: string;
		onmutated: () => Promise<void> | void;
	};

	let { sessions, currentSessionId, onmutated }: Props = $props();
	let busyId = $state<string | null>(null);
	let message = $state('');

	function errorMessage(error: unknown): string {
		return error instanceof AdminApiError ? error.message : '工作階段操作失敗。';
	}

	function sessionLabel(session: ManagedAuthSession): string {
		return session.userAgent?.split(' ')[0] ?? '未知裝置';
	}

	async function revoke(sessionId: string) {
		if (!window.confirm('確定要登出這個工作階段嗎？')) return;
		busyId = sessionId;
		message = '';
		try {
			await revokeAuthSession(sessionId);
			await onmutated();
		} catch (error) {
			message = errorMessage(error);
		} finally {
			busyId = null;
		}
	}

	async function revokeOthers() {
		if (!window.confirm('確定要登出其他所有工作階段嗎？')) return;
		busyId = 'all';
		message = '';
		try {
			await revokeOtherAuthSessions();
			await onmutated();
		} catch (error) {
			message = errorMessage(error);
		} finally {
			busyId = null;
		}
	}
</script>

<section class="rounded-lg border border-border bg-bg-surface p-5 shadow-xs">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="flex items-start gap-3">
			<div
				class="grid size-9 shrink-0 place-items-center rounded-md bg-brand-subtle text-text-accent"
			>
				<MonitorSmartphone class="size-4" />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-text-heading">登入工作階段</h2>
				<p class="mt-1 text-sm text-text-muted">查看並登出不再使用的裝置。</p>
			</div>
		</div>
		<button
			type="button"
			disabled={busyId !== null || sessions.every((session) => session.id === currentSessionId)}
			onclick={revokeOthers}
			class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-text-body hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-55"
		>
			<LogOut class="size-4" />登出其他裝置
		</button>
	</div>

	{#if message}<p
			class="mt-4 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
		>
			{message}
		</p>{/if}

	{#if sessions.length === 0}
		<p class="mt-5 text-sm text-text-muted">目前沒有可顯示的工作階段。</p>
	{:else}
		<ul class="mt-5 divide-y divide-border">
			{#each sessions as session (session.id)}
				{@const isCurrent = session.id === currentSessionId}
				<li class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<p class="text-sm font-semibold text-text-heading">{sessionLabel(session)}</p>
							{#if isCurrent}<span
									class="rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-semibold text-text-accent"
								>
									目前使用中
								</span>{/if}
						</div>
						<p class="mt-1 text-xs text-text-muted">
							{session.ipAddress ?? '未知位置'} · 登入於 {formatDateTime(session.authenticatedAt)}
						</p>
					</div>
					{#if !isCurrent}
						<button
							type="button"
							aria-label="登出工作階段"
							title="登出工作階段"
							disabled={busyId !== null}
							onclick={() => revoke(session.id)}
							class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-danger/30 px-3 text-sm font-semibold text-danger hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-55"
						>
							<LogOut class="size-4" />登出
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
