<script lang="ts">
	import { Building2, PencilLine, RotateCcw, Search, Trash2 } from '@lucide/svelte';

	import Badge from '$lib/components/Badge.svelte';
	import type { ActionData, PageData } from './$types';

	type BusinessFilter = 'all' | 'active' | 'archived';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let search = $state('');
	let status = $state<BusinessFilter>('all');
	let selectedBusinessId = $state('');
	let editName = $state('');
	let editContactName = $state('');
	let editContactEmail = $state('');
	let editContactPhone = $state('');
	let editTaxId = $state('');
	let editAddress = $state('');
	let editNotes = $state('');

	const filteredBusinesses = $derived.by(() => {
		const query = search.trim().toLowerCase();

		return data.businesses.filter((business) => {
			const matchesSearch =
				!query ||
				[
					business.name,
					business.contactName ?? '',
					business.contactEmail ?? '',
					business.contactPhone ?? '',
					business.taxId ?? '',
					business.address ?? ''
				]
					.join(' ')
					.toLowerCase()
					.includes(query);
			const matchesStatus =
				status === 'all' || (status === 'active' ? !business.isDeleted : business.isDeleted);

			return matchesSearch && matchesStatus;
		});
	});

	const selectedBusiness = $derived(
		data.businesses.find((business) => business.id === selectedBusinessId) ?? null
	);

	$effect(() => {
		if (!selectedBusinessId && data.businesses.length > 0) {
			selectedBusinessId =
				data.businesses.find((business) => !business.isDeleted)?.id ?? data.businesses[0]?.id ?? '';
		}

		if (!selectedBusiness) {
			editName = '';
			editContactName = '';
			editContactEmail = '';
			editContactPhone = '';
			editTaxId = '';
			editAddress = '';
			editNotes = '';
			return;
		}

		editName = selectedBusiness.name;
		editContactName = selectedBusiness.contactName ?? '';
		editContactEmail = selectedBusiness.contactEmail ?? '';
		editContactPhone = selectedBusiness.contactPhone ?? '';
		editTaxId = selectedBusiness.taxId ?? '';
		editAddress = selectedBusiness.address ?? '';
		editNotes = selectedBusiness.notes ?? '';
	});

	function resetFilters() {
		search = '';
		status = 'all';
	}

	function selectBusiness(businessId: string) {
		selectedBusinessId = businessId;
	}
</script>

<svelte:head>
	<title>企業 | 管理後台</title>
</svelte:head>

<div class="space-y-5">
	<div class="flex flex-col gap-3 sm:flex-wrap sm:flex-row sm:items-center sm:justify-between">
		<h2 class="text-xl font-semibold tracking-normal text-text-heading">企業管理</h2>
	</div>

	<section
		class="grid gap-3 sm:grid-cols-3"
		aria-label="企業摘要"
	>
		{#each data.summary as item (item.label)}
			<article class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
				<span class="text-sm font-medium text-text-muted">{item.label}</span>
				<strong class="mt-2 block text-2xl text-text-heading">{item.value}</strong>
			</article>
		{/each}
	</section>

	<section class="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,24rem)]">
		<article class="rounded-lg border border-border bg-bg-surface shadow-xs">
			<div class="flex flex-col gap-3 border-b border-border p-4 2xl:flex-row 2xl:items-center">
				<h2 class="text-lg font-semibold tracking-normal text-text-heading">企業列表</h2>
				<div class="flex min-w-0 flex-1 flex-wrap gap-2">
					<label class="relative block min-w-[16rem] flex-1 basis-[18rem]">
						<Search
							class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
						/>
						<input
							bind:value={search}
							type="search"
							class="h-10 w-full rounded-md border border-border bg-bg-surface pl-9 pr-3 text-sm text-text-body"
							placeholder="搜尋企業、聯絡人或統編"
						/>
					</label>

					<label class="min-w-40 flex-1 basis-40 sm:flex-none sm:w-40">
						<select
							bind:value={status}
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						>
							<option value="all">全部狀態</option>
							<option value="active">啟用中</option>
							<option value="archived">已封存</option>
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

			<div class="grid gap-3 p-4">
				{#each filteredBusinesses as business (business.id)}
					<article
						class={`rounded-lg border p-4 transition ${
							business.id === selectedBusinessId
								? 'border-brand bg-brand-muted/8'
								: 'border-border bg-bg-surface'
						}`}
					>
						<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<strong class="text-text-heading">{business.name}</strong>
									<Badge tone={business.isDeleted ? 'warning' : 'success'}>
										{business.isDeleted ? '已封存' : '啟用中'}
									</Badge>
								</div>
								<div class="mt-2 grid gap-2 text-sm text-text-muted sm:grid-cols-2">
									<span>{business.contactName ?? '未填寫聯絡人'}</span>
									<span>{business.contactEmail ?? '未填寫電子郵件'}</span>
									<span>{business.contactPhone ?? '未填寫電話'}</span>
									<span>{business.taxId ?? '未填寫統編'}</span>
								</div>
								<p class="mt-2 text-sm text-text-muted">{business.address ?? '未填寫地址'}</p>
							</div>

							<div class="flex flex-wrap justify-end gap-2">
								<button
									type="button"
									class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-text-body hover:bg-bg-sunken"
									onclick={() => selectBusiness(business.id)}
								>
									<PencilLine class="size-4" />
									編輯
								</button>

								{#if business.isDeleted}
									<form
										method="POST"
										action="?/restore"
									>
										<input
											type="hidden"
											name="businessId"
											value={business.id}
										/>
										<button
											type="submit"
											class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-text-body hover:bg-bg-sunken"
										>
											<RotateCcw class="size-4" />
											還原
										</button>
									</form>
								{:else}
									<form
										method="POST"
										action="?/delete"
									>
										<input
											type="hidden"
											name="businessId"
											value={business.id}
										/>
										<button
											type="submit"
											class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-danger/30 px-3 text-sm font-semibold text-danger hover:bg-danger-bg"
										>
											<Trash2 class="size-4" />
											封存
										</button>
									</form>
								{/if}
							</div>
						</div>

						<div class="mt-3 text-xs text-text-muted">最近更新：{business.updatedAt}</div>
					</article>
				{/each}
			</div>

			<div class="border-t border-border px-4 py-3 text-sm text-text-muted">
				顯示 {filteredBusinesses.length} / {data.businesses.length} 筆企業資料
			</div>
		</article>

		<div class="space-y-5">
			<section class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
				<div class="mb-4 flex items-center gap-2">
					<Building2 class="size-5 text-brand" />
					<h2 class="text-lg font-semibold tracking-normal text-text-heading">新增企業</h2>
				</div>

				<form
					method="POST"
					action="?/create"
					class="space-y-3"
				>
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">企業名稱</span>
						<input
							name="name"
							required
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">聯絡人</span>
						<input
							name="contactName"
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">電子郵件</span>
						<input
							name="contactEmail"
							type="email"
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">電話</span>
						<input
							name="contactPhone"
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">統一編號</span>
						<input
							name="taxId"
							class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">地址</span>
						<textarea
							name="address"
							rows="2"
							class="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-body"></textarea>
					</label>
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-text-heading">備註</span>
						<textarea
							name="notes"
							rows="3"
							class="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-body"></textarea>
					</label>

					{#if form?.createError}
						<p
							class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
						>
							{form.createError}
						</p>
					{/if}

					{#if form?.createSuccess}
						<p
							class="rounded-md border border-success/20 bg-success-bg px-3 py-2 text-sm text-success"
						>
							{form.createSuccess}
						</p>
					{/if}

					<button
						type="submit"
						class="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
					>
						新增企業
					</button>
				</form>
			</section>

			<section class="rounded-lg border border-border bg-bg-surface p-4 shadow-xs">
				<h2 class="mb-4 text-lg font-semibold tracking-normal text-text-heading">編輯企業</h2>

				{#if selectedBusiness}
					<form
						method="POST"
						action="?/update"
						class="space-y-3"
					>
						<input
							type="hidden"
							name="businessId"
							value={selectedBusiness.id}
						/>
						<label class="block">
							<span class="mb-1 block text-sm font-medium text-text-heading">企業名稱</span>
							<input
								name="name"
								required
								bind:value={editName}
								class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
							/>
						</label>
						<label class="block">
							<span class="mb-1 block text-sm font-medium text-text-heading">聯絡人</span>
							<input
								name="contactName"
								bind:value={editContactName}
								class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
							/>
						</label>
						<label class="block">
							<span class="mb-1 block text-sm font-medium text-text-heading">電子郵件</span>
							<input
								name="contactEmail"
								type="email"
								bind:value={editContactEmail}
								class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
							/>
						</label>
						<label class="block">
							<span class="mb-1 block text-sm font-medium text-text-heading">電話</span>
							<input
								name="contactPhone"
								bind:value={editContactPhone}
								class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
							/>
						</label>
						<label class="block">
							<span class="mb-1 block text-sm font-medium text-text-heading">統一編號</span>
							<input
								name="taxId"
								bind:value={editTaxId}
								class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text-body"
							/>
						</label>
						<label class="block">
							<span class="mb-1 block text-sm font-medium text-text-heading">地址</span>
							<textarea
								name="address"
								rows="2"
								bind:value={editAddress}
								class="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-body"></textarea>
						</label>
						<label class="block">
							<span class="mb-1 block text-sm font-medium text-text-heading">備註</span>
							<textarea
								name="notes"
								rows="3"
								bind:value={editNotes}
								class="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-body"></textarea>
						</label>

						{#if form?.updateError}
							<p
								class="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
							>
								{form.updateError}
							</p>
						{/if}

						{#if form?.updateSuccess}
							<p
								class="rounded-md border border-success/20 bg-success-bg px-3 py-2 text-sm text-success"
							>
								{form.updateSuccess}
							</p>
						{/if}

						<button
							type="submit"
							class="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-bg-surface px-4 text-sm font-semibold text-text-body hover:bg-bg-sunken"
						>
							儲存變更
						</button>
					</form>
				{:else}
					<p class="text-sm text-text-muted">目前沒有可編輯的企業資料。</p>
				{/if}

				{#if form?.deleteError}
					<p
						class="mt-3 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
					>
						{form.deleteError}
					</p>
				{/if}
				{#if form?.deleteSuccess}
					<p
						class="mt-3 rounded-md border border-success/20 bg-success-bg px-3 py-2 text-sm text-success"
					>
						{form.deleteSuccess}
					</p>
				{/if}
				{#if form?.restoreError}
					<p
						class="mt-3 rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger"
					>
						{form.restoreError}
					</p>
				{/if}
				{#if form?.restoreSuccess}
					<p
						class="mt-3 rounded-md border border-success/20 bg-success-bg px-3 py-2 text-sm text-success"
					>
						{form.restoreSuccess}
					</p>
				{/if}
			</section>
		</div>
	</section>
</div>
