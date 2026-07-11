<script lang="ts">
	import { Edit3, MoreHorizontal, RotateCcw, Search, UserPlus } from '@lucide/svelte';

	import Badge from '$lib/components/Badge.svelte';
	import { localizeAdminLabel } from '$lib/labels';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type StaffStatusFilter = 'all' | PageData['staff'][number]['status'];
	type StaffRoleFilter = 'all' | PageData['staff'][number]['roles'][number];

	let search = $state('');
	let status = $state<StaffStatusFilter>('all');
	let role = $state<StaffRoleFilter>('all');

	const filteredStaff = $derived.by(() => {
		const query = search.trim().toLowerCase();

		return data.staff.filter((staff) => {
			const matchesSearch =
				!query || [staff.name, staff.email].join(' ').toLowerCase().includes(query);
			const matchesStatus = status === 'all' || staff.status === status;
			const matchesRole = role === 'all' || staff.roles.includes(role);

			return matchesSearch && matchesStatus && matchesRole;
		});
	});

	function resetFilters() {
		search = '';
		status = 'all';
		role = 'all';
	}

	function staffTone(staffStatus: string): 'success' | 'danger' | 'neutral' {
		if (staffStatus === 'active') return 'success';
		if (staffStatus === 'suspended') return 'danger';
		return 'neutral';
	}
</script>

<svelte:head>
	<title>人員 | 管理後台</title>
</svelte:head>

<div class="space-y-5">
	<div class="flex flex-col gap-3 sm:flex-wrap sm:flex-row sm:items-center sm:justify-between">
		<h2 class="text-xl font-semibold tracking-normal text-text-heading">人員管理</h2>
		<button
			type="button"
			disabled
			class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent opacity-55"
		>
			<UserPlus class="size-4" />
			新增人員
		</button>
	</div>

	<section
		class="rounded-lg border border-border bg-bg-surface shadow-xs"
		aria-labelledby="staff-list"
	>
		<div class="flex flex-col gap-3 border-b border-border p-4 2xl:flex-row 2xl:items-center">
			<h2
				id="staff-list"
				class="text-lg font-semibold tracking-normal text-text-heading"
			>
				人員紀錄
			</h2>
			<div class="flex min-w-0 flex-1 flex-wrap gap-2">
				<label class="relative block min-w-[16rem] flex-1 basis-[18rem]">
					<Search
						class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
					/>
					<input
						bind:value={search}
						type="search"
						placeholder="搜尋姓名或電子郵件"
						class="h-10 w-full rounded-md border border-border bg-bg-surface pl-9 pr-3 text-sm"
					/>
				</label>

				<label class="min-w-44 flex-1 basis-44 sm:flex-none sm:w-44">
					<select
						bind:value={status}
						class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
					>
						<option value="all">全部狀態</option>
						{#each data.statusOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<label class="min-w-44 flex-1 basis-44 sm:flex-none sm:w-44">
					<select
						bind:value={role}
						class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
					>
						<option value="all">全部角色</option>
						{#each data.roleOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>

				<button
					type="button"
					class="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-bg-surface px-3 text-sm font-semibold text-text-body hover:bg-bg-sunken"
					onclick={resetFilters}
				>
					<RotateCcw class="size-4" />
					重設
				</button>
			</div>
		</div>

		<div class="hidden xl:block">
			<table class="w-full text-left text-sm">
				<thead
					class="border-b border-border bg-bg-sunken text-xs uppercase tracking-caps text-text-muted"
				>
					<tr>
						<th class="px-4 py-3">人員</th>
						<th class="px-4 py-3">角色</th>
						<th class="px-4 py-3">狀態</th>
						<th class="px-4 py-3">最後活動</th>
						<th class="px-4 py-3 text-right">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each filteredStaff as staff (staff.id)}
						<tr>
							<td class="px-4 py-4">
								<strong class="block text-text-heading">{staff.name}</strong>
								<span class="text-xs text-text-muted">{staff.email}</span>
							</td>
							<td class="px-4 py-4">
								<div class="flex flex-wrap gap-2">
									{#each staff.roles as roleName (roleName)}
										<Badge tone="accent">{localizeAdminLabel(roleName)}</Badge>
									{/each}
								</div>
							</td>
							<td class="px-4 py-4">
								<Badge tone={staffTone(staff.status)}>{localizeAdminLabel(staff.status)}</Badge>
							</td>
							<td class="px-4 py-4 text-text-muted">{staff.lastLoginAt ?? '尚無活動'}</td>
							<td class="px-4 py-4">
								<div class="flex justify-end gap-2">
									<button
										type="button"
										disabled
										class="inline-grid size-9 place-items-center rounded-md border border-border text-text-muted opacity-55"
										aria-label={`編輯 ${staff.name}`}
									>
										<Edit3 class="size-4" />
									</button>
									<button
										type="button"
										disabled
										class="inline-grid size-9 place-items-center rounded-md border border-border text-text-muted opacity-55"
										aria-label={`${staff.name} 的更多操作`}
									>
										<MoreHorizontal class="size-4" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="grid gap-3 p-4 xl:hidden">
			{#each filteredStaff as staff (staff.id)}
				<article class="rounded-lg border border-border bg-bg-surface p-4">
					<div class="flex items-start justify-between gap-3">
						<div>
							<strong class="block text-text-heading">{staff.name}</strong>
							<span class="text-xs text-text-muted">{staff.email}</span>
						</div>
						<Badge tone={staffTone(staff.status)}>{localizeAdminLabel(staff.status)}</Badge>
					</div>
					<div class="mt-4 flex flex-wrap gap-2">
						{#each staff.roles as roleName (roleName)}
							<Badge tone="accent">{localizeAdminLabel(roleName)}</Badge>
						{/each}
					</div>
					<div class="mt-4 text-sm">
						<span class="block text-text-muted">最後活動</span>
						<strong class="block text-text-heading">{staff.lastLoginAt ?? '尚無活動'}</strong>
					</div>
				</article>
			{/each}
		</div>

		<div class="border-t border-border px-4 py-3 text-sm text-text-muted">
			顯示 {filteredStaff.length} / {data.staff.length} 位人員
		</div>
	</section>
</div>
