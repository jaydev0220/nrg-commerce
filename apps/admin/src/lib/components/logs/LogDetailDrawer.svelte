<script lang="ts">
	import { X } from '@lucide/svelte';

	import { formatDateTime, type ManagedLog } from '$lib/api/admin-api';
	import { localizeAdminLabel } from '$lib/labels';

	let { detail, onclose }: { detail: ManagedLog; onclose: () => void } = $props();
</script>

<div
	class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
	role="presentation"
	onclick={(event) => {
		if (event.target === event.currentTarget) onclose();
	}}
>
	<div
		class="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-bg-surface shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-label="日誌詳細資料"
	>
		<header
			class="sticky top-0 flex items-center justify-between gap-3 border-b border-border bg-bg-surface p-4"
		>
			<div class="min-w-0">
				<p class="truncate text-xs text-text-muted">{detail.id}</p>
				<h2 class="mt-1 truncate text-lg font-semibold text-text-heading">{detail.message}</h2>
			</div>
			<button
				type="button"
				class="inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-md border border-border"
				aria-label="關閉日誌詳細資料"
				title="關閉"
				onclick={onclose}
			>
				<X class="size-4" />
			</button>
		</header>
		<div class="grid gap-4 p-5 sm:grid-cols-2">
			<div>
				<p class="text-xs text-text-muted">建立時間</p>
				<p class="mt-1 text-sm text-text-heading">{formatDateTime(detail.createdAt)}</p>
			</div>
			<div>
				<p class="text-xs text-text-muted">保留期限</p>
				<p class="mt-1 text-sm text-text-heading">{formatDateTime(detail.expiresAt)}</p>
			</div>
			<div>
				<p class="text-xs text-text-muted">層級與類型</p>
				<p class="mt-1 text-sm text-text-heading">
					{localizeAdminLabel(detail.level)} / {localizeAdminLabel(detail.kind)}
				</p>
			</div>
			<div>
				<p class="text-xs text-text-muted">請求</p>
				<p class="mt-1 break-all text-sm text-text-heading">
					{detail.method ?? ''}
					{detail.path ?? ''}
					{detail.statusCode ?? ''}
				</p>
			</div>
			<div>
				<p class="text-xs text-text-muted">請求識別碼</p>
				<p class="mt-1 break-all text-sm text-text-heading">{detail.requestId ?? '無'}</p>
			</div>
			<div>
				<p class="text-xs text-text-muted">關聯資料</p>
				<p class="mt-1 break-all text-sm text-text-heading">
					{detail.entityType ?? ''}
					{detail.entityId ?? ''}
				</p>
			</div>
			<div class="sm:col-span-2">
				<p class="text-xs text-text-muted">詳細資料</p>
				<pre
					class="mt-1 max-h-64 overflow-auto rounded-md bg-bg-sunken p-3 text-xs text-text-heading">{JSON.stringify(
						detail.metadata ?? {},
						null,
						2
					)}</pre>
			</div>
		</div>
	</div>
</div>
