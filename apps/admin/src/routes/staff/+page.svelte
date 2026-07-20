<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		Edit3,
		KeyRound,
		RotateCcw,
		Search,
		ShieldCheck,
		Trash2,
		Undo2,
		UserPlus
	} from '@lucide/svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	import {
		AdminApiError,
		createStaff,
		deleteStaff,
		resetStaffMfa,
		resetStaffPassword,
		restoreStaff,
		updateStaff
	} from '$lib/api/admin-api';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Drawer from '$lib/components/shared/Drawer.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import Tooltip from '$lib/components/shared/Tooltip.svelte';
	import { applyFilters, scheduleFilters } from '$lib/filter-navigation';
	import { localizeAdminLabel } from '$lib/labels';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let formError = $state('');
	let successMessage = $state('');
	let initialPassword = $state<string | null>(null);
	let drawerMode = $state<'create' | 'edit' | null>(null);
	let selected = $state<PageData['staff'][number] | null>(null);
	const permissions = $derived(
		new Set(data.currentStaff?.roles.flatMap((role) => role.permissions) ?? [])
	);
	const isAdmin = $derived(data.currentStaff?.roles.some((role) => role.key === 'admin') ?? false);
	const canCreate = $derived(permissions.has('staff.create'));
	const canUpdate = $derived(permissions.has('staff.update'));
	const canDelete = $derived(permissions.has('staff.delete'));

	function openEditor(member?: PageData['staff'][number]) {
		selected = member ?? null;
		drawerMode = member ? 'edit' : 'create';
	}

	function closeEditor() {
		selected = null;
		drawerMode = null;
	}

	function tone(status: string): 'success' | 'danger' | 'neutral' {
		return status === 'active' ? 'success' : status === 'suspended' ? 'danger' : 'neutral';
	}

	function apiMessage(error: unknown, fallback: string): string {
		return error instanceof AdminApiError || error instanceof Error ? error.message : fallback;
	}

	async function saveStaff(event: SubmitEvent) {
		event.preventDefault();
		formError = '';
		successMessage = '';
		const values = new FormData(event.currentTarget as HTMLFormElement);
		const name = String(values.get('name') ?? '').trim();
		const email = String(values.get('email') ?? '').trim();
		const roleIds = values.getAll('roleIds').map(String).filter(Boolean);
		if (!name || !email || roleIds.length === 0) {
			formError = '請填寫姓名、電子郵件並選擇至少一個角色。';
			return;
		}
		try {
			if (drawerMode === 'edit' && selected) {
				await updateStaff(selected.id, {
					name,
					email,
					roleIds,
					status: String(values.get('status') ?? 'active') as PageData['staff'][number]['status']
				});
				successMessage = '已更新人員資料。';
			} else {
				const result = await createStaff({ name, email, roleIds });
				initialPassword = result.initialPassword;
				successMessage = '已建立人員帳號，請安全交付一次性初始密碼。';
			}
			closeEditor();
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法儲存人員資料。');
		}
	}

	async function staffAction(
		event: SubmitEvent,
		action: 'resetMfa' | 'resetPassword' | 'restore' | 'delete'
	) {
		event.preventDefault();
		formError = '';
		successMessage = '';
		const staffId = String(
			new FormData(event.currentTarget as HTMLFormElement).get('staffId') ?? ''
		);
		try {
			if (action === 'resetMfa') {
				await resetStaffMfa(staffId);
				successMessage = '已重設多重要素驗證。';
			} else if (action === 'resetPassword') {
				const result = await resetStaffPassword(staffId);
				initialPassword = result.initialPassword;
				successMessage = '已重設密碼，請安全交付一次性初始密碼。';
			} else if (action === 'restore') {
				await restoreStaff(staffId);
				successMessage = '已還原人員。';
			} else {
				await deleteStaff(staffId);
				successMessage = '已封存人員。';
			}
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法更新人員資料。');
		}
	}
</script>

<svelte:head><title>人員 | 管理後台</title></svelte:head>

<div class="space-y-5">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-xl font-semibold text-text-heading">人員管理</h1>
		{#if canCreate}
			<button
				type="button"
				class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
				onclick={() => openEditor()}
			>
				<UserPlus class="size-4" />新增人員
			</button>
		{/if}
	</header>

	{#if formError}
		<p
			class="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
			role="alert"
		>
			{formError}
		</p>
	{/if}
	{#if successMessage}
		<p
			class="rounded-md border border-success/30 bg-success-bg p-3 text-sm text-success"
			role="status"
		>
			{successMessage}
		</p>
	{/if}

	<section class="rounded-lg border border-border bg-bg-surface shadow-xs">
		<form
			class="flex flex-wrap items-center gap-2 border-b border-border p-4"
			onsubmit={(event) => event.preventDefault()}
			oninput={(event) => scheduleFilters('/staff', event.currentTarget as HTMLFormElement)}
			onchange={(event) => applyFilters('/staff', event.currentTarget as HTMLFormElement)}
		>
			<label class="relative min-w-0 flex-[1_1_16rem]">
				<Search class="pointer-events-none absolute top-3 left-3 size-4 text-text-muted" />
				<input
					name="search"
					value={page.url.searchParams.get('search') ?? ''}
					aria-label="搜尋人員"
					class="h-10 w-full rounded-md border border-border bg-bg-surface pr-3 pl-9 text-sm"
				/>
			</label>
			<select
				name="status"
				aria-label="依狀態篩選"
				class="h-10 min-w-32 flex-1 rounded-md border border-border bg-bg-surface px-3 text-sm"
			>
				<option
					value=""
					selected={!page.url.searchParams.has('status')}
				>
					全部狀態
				</option>
				{#each data.statusOptions as option (option.value)}
					<option
						value={option.value}
						selected={page.url.searchParams.get('status') === option.value}
					>
						{option.label}
					</option>
				{/each}
			</select>
			<select
				name="roleId"
				aria-label="依角色篩選"
				class="h-10 min-w-32 flex-1 rounded-md border border-border bg-bg-surface px-3 text-sm"
			>
				<option
					value=""
					selected={!page.url.searchParams.has('roleId')}
				>
					全部角色
				</option>
				{#each data.roleOptions as option (option.value)}
					<option
						value={option.value}
						selected={page.url.searchParams.get('roleId') === option.value}
					>
						{option.label}
					</option>
				{/each}
			</select>
			<select
				name="archived"
				aria-label="人員封存狀態"
				class="h-10 min-w-32 flex-1 rounded-md border border-border bg-bg-surface px-3 text-sm"
			>
				<option
					value="false"
					selected={page.url.searchParams.get('archived') !== 'true'}
				>
					顯示使用中
				</option>
				<option
					value="true"
					selected={page.url.searchParams.get('archived') === 'true'}
				>
					顯示已封存
				</option>
			</select>
			<a
				href={resolve('/staff')}
				class="inline-grid size-10 shrink-0 cursor-pointer place-items-center rounded-md border border-border"
				aria-label="重設篩選"
			>
				<RotateCcw class="size-4" />
			</a>
		</form>

		<div class="overflow-x-auto">
			<table class="w-full min-w-[900px] text-left text-sm">
				<thead class="border-b border-border bg-bg-sunken text-xs text-text-muted">
					<tr>
						<th class="px-4 py-3">人員</th>
						<th class="px-4 py-3">角色</th>
						<th class="px-4 py-3">狀態</th>
						<th class="px-4 py-3">最後登入</th>
						<th class="px-4 py-3 text-right">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.staff as member (member.id)}
						<tr>
							<td class="px-4 py-4">
								<strong class="block text-text-heading">{member.name}</strong>
								<span class="text-xs text-text-muted">{member.email}</span>
							</td>
							<td class="px-4 py-4">
								<div class="flex flex-wrap gap-1">
									{#each member.roleLabels as role (role)}
										<Badge tone="accent">{role}</Badge>
									{/each}
								</div>
							</td>
							<td class="px-4 py-4">
								<Badge tone={member.isDeleted ? 'warning' : tone(member.status)}>
									{member.isDeleted ? '已封存' : localizeAdminLabel(member.status)}
								</Badge>
							</td>
							<td class="px-4 py-4 text-text-muted">{member.lastLoginLabel}</td>
							<td class="px-4 py-4">
								<div class="flex justify-end gap-2">
									{#if canUpdate && !member.isDeleted}
										<Tooltip label="編輯人員">
											<button
												type="button"
												class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
												aria-label="編輯人員"
												onclick={() => openEditor(member)}
											>
												<Edit3 class="size-4" />
											</button>
										</Tooltip>
										<form onsubmit={(event) => staffAction(event, 'resetMfa')}>
											<input
												type="hidden"
												name="staffId"
												value={member.id}
											/>
											<Tooltip label="重設多重要素驗證">
												<button
													type="submit"
													class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
													aria-label="重設多重要素驗證"
												>
													<ShieldCheck class="size-4" />
												</button>
											</Tooltip>
										</form>
										{#if isAdmin}
											<form onsubmit={(event) => staffAction(event, 'resetPassword')}>
												<input
													type="hidden"
													name="staffId"
													value={member.id}
												/>
												<Tooltip label="重設密碼">
													<button
														type="submit"
														class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
														aria-label="重設密碼"
													>
														<KeyRound class="size-4" />
													</button>
												</Tooltip>
											</form>
										{/if}
									{/if}
									{#if member.isDeleted && canUpdate}
										<form onsubmit={(event) => staffAction(event, 'restore')}>
											<input
												type="hidden"
												name="staffId"
												value={member.id}
											/>
											<Tooltip label="還原人員">
												<button
													type="submit"
													class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
													aria-label="還原人員"
												>
													<Undo2 class="size-4" />
												</button>
											</Tooltip>
										</form>
									{:else if canDelete && member.id !== data.currentStaff?.id}
										<form onsubmit={(event) => staffAction(event, 'delete')}>
											<input
												type="hidden"
												name="staffId"
												value={member.id}
											/>
											<Tooltip label="封存人員">
												<button
													type="submit"
													class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border text-danger"
													aria-label="封存人員"
												>
													<Trash2 class="size-4" />
												</button>
											</Tooltip>
										</form>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pagination pagination={data.pagination} />
	</section>
</div>

<Drawer
	open={drawerMode !== null}
	title={drawerMode === 'create' ? '新增人員' : '編輯人員'}
	onclose={closeEditor}
>
	<form
		class="space-y-4"
		onsubmit={saveStaff}
	>
		<label class="block text-sm font-medium">
			姓名
			<input
				required
				name="name"
				value={selected?.name ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		<label class="block text-sm font-medium">
			電子郵件
			<input
				required
				type="email"
				name="email"
				value={selected?.email ?? ''}
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
			/>
		</label>
		{#if selected}
			<label class="block text-sm font-medium">
				狀態
				<select
					name="status"
					value={selected.status}
					class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
				>
					{#each data.statusOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
		{/if}
		<fieldset>
			<legend class="mb-2 text-sm font-medium">角色</legend>
			<div class="space-y-2">
				{#each data.roleOptions as role (role.value)}
					<label class="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="roleIds"
							value={role.value}
							checked={selected?.roleIds.includes(role.value) ?? false}
							class="size-4"
						/>
						{role.label}
					</label>
				{/each}
			</div>
		</fieldset>
		{#if drawerMode === 'create'}
			<p class="rounded-md border border-border bg-bg-sunken p-3 text-sm text-text-muted">
				系統會產生符合安全政策的一次性初始密碼。
			</p>
		{/if}
		<button
			type="submit"
			class="h-10 w-full cursor-pointer rounded-md bg-brand text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
		>
			儲存人員
		</button>
	</form>
</Drawer>

{#if initialPassword}
	<div
		class="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"
		role="presentation"
	>
		<div
			class="w-full max-w-md rounded-lg border border-border bg-bg-surface p-5 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-label="一次性初始密碼"
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<h2 class="text-lg font-semibold text-text-heading">一次性初始密碼</h2>
					<p class="mt-1 text-sm text-text-muted">此密碼只會顯示一次，請安全交付。</p>
				</div>
				<button
					type="button"
					class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
					aria-label="關閉"
					onclick={() => (initialPassword = null)}
				>
					×
				</button>
			</div>
			<code class="mt-4 block rounded-md bg-bg-sunken p-3 text-sm break-all text-text-heading">
				{initialPassword}
			</code>
			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					class="h-10 cursor-pointer rounded-md border border-border px-4 text-sm"
					aria-label="複製密碼"
					onclick={() => navigator.clipboard.writeText(initialPassword ?? '')}
				>
					複製密碼
				</button>
				<button
					type="button"
					class="h-10 cursor-pointer rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent"
					aria-label="完成"
					onclick={() => (initialPassword = null)}
				>
					完成
				</button>
			</div>
		</div>
	</div>
{/if}
