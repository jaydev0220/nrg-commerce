<script lang="ts">
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { Building2, Pencil, RotateCcw, Search, Trash2, Undo2 } from '@lucide/svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	import {
		AdminApiError,
		bulkUpdateBusinessLabel,
		createBusiness,
		createBusinessLabel,
		deleteBusiness,
		deleteBusinessLabel,
		restoreBusiness,
		restoreBusinessLabel,
		updateBusiness,
		updateBusinessLabel
	} from '$lib/api/admin-api';
	import BusinessEditorDrawer from '$lib/components/businesses/BusinessEditorDrawer.svelte';
	import BusinessLabelEditorDrawer from '$lib/components/businesses/BusinessLabelEditorDrawer.svelte';
	import BusinessLabels from '$lib/components/businesses/BusinessLabels.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import { applyFilters, scheduleFilters } from '$lib/filter-navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let formError = $state('');
	let businessMode = $state<'create' | 'edit' | null>(null);
	let selectedBusiness = $state<PageData['businesses'][number] | null>(null);
	let labelMode = $state<'create' | 'edit' | null>(null);
	let selectedLabel = $state<PageData['labels'][number] | null>(null);
	let labelColor = $state('#2F6FED');
	let labelView = $state<'active' | 'archived'>('active');
	let selectedIds = $state<string[]>([]);
	let bulkLabelId = $state('');
	let bulkBusy = $state(false);

	const labelColors = ['#2F6FED', '#0F766E', '#B45309', '#BE123C', '#7C3AED', '#475569'];
	const permissions = $derived(
		new Set(data.currentStaff?.roles.flatMap((role) => role.permissions) ?? [])
	);
	const canWrite = $derived(permissions.has('business.write'));
	const selectableBusinesses = $derived(data.businesses.filter((business) => !business.isDeleted));
	const allSelected = $derived(
		canWrite &&
			selectableBusinesses.length > 0 &&
			selectableBusinesses.every((business) => selectedIds.includes(business.id))
	);
	const activeLabels = $derived(data.labels.filter((label) => !label.deletedAt));

	afterNavigate(() => {
		selectedIds = [];
	});

	function openBusiness(business?: PageData['businesses'][number]) {
		selectedBusiness = business ?? null;
		businessMode = business ? 'edit' : 'create';
	}

	function closeBusiness() {
		selectedBusiness = null;
		businessMode = null;
	}

	function openLabel(label?: PageData['labels'][number]) {
		selectedLabel = label ?? null;
		labelColor = label?.color ?? labelColors[0]!;
		labelMode = label ? 'edit' : 'create';
	}

	function closeLabel() {
		selectedLabel = null;
		labelMode = null;
	}

	function toggleSelected(businessId: string, checked: boolean) {
		selectedIds = checked
			? [...new Set([...selectedIds, businessId])]
			: selectedIds.filter((id) => id !== businessId);
	}

	function toggleAll(checked: boolean) {
		selectedIds = checked ? selectableBusinesses.map((business) => business.id) : [];
	}

	function optional(values: FormData, name: string): string | undefined {
		const value = String(values.get(name) ?? '').trim();
		return value || undefined;
	}

	function optionalNullable(values: FormData, name: string): string | null {
		return optional(values, name) ?? null;
	}

	function apiMessage(error: unknown, fallback: string): string {
		return error instanceof AdminApiError || error instanceof Error ? error.message : fallback;
	}

	async function saveBusiness(event: SubmitEvent) {
		event.preventDefault();
		formError = '';
		const values = new FormData(event.currentTarget as HTMLFormElement);
		const name = String(values.get('name') ?? '').trim();
		const labelId = optional(values, 'labelId') ?? null;
		try {
			if (!name) throw new Error('請輸入企業名稱。');
			const updateInput = {
				name,
				contactName: optionalNullable(values, 'contactName'),
				contactEmail: optionalNullable(values, 'contactEmail'),
				contactPhone: optionalNullable(values, 'contactPhone'),
				taxId: optionalNullable(values, 'taxId'),
				address: optionalNullable(values, 'address'),
				notes: optionalNullable(values, 'notes'),
				labelId
			};
			if (businessMode === 'edit' && selectedBusiness) {
				await updateBusiness(selectedBusiness.id, updateInput);
			} else {
				await createBusiness({
					name,
					contactName: optional(values, 'contactName'),
					contactEmail: optional(values, 'contactEmail'),
					contactPhone: optional(values, 'contactPhone'),
					taxId: optional(values, 'taxId'),
					address: optional(values, 'address'),
					notes: optional(values, 'notes'),
					labelId
				});
			}
			closeBusiness();
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法儲存企業資料。');
		}
	}

	async function saveLabel(event: SubmitEvent) {
		event.preventDefault();
		formError = '';
		const values = new FormData(event.currentTarget as HTMLFormElement);
		const rawDiscount = String(values.get('discountRate') ?? '').trim();
		const input = {
			name: String(values.get('name') ?? '').trim(),
			color: String(values.get('color') ?? labelColor),
			discountRate: rawDiscount ? Number(rawDiscount) : null
		};
		try {
			if (!input.name) throw new Error('請輸入標籤名稱。');
			if (
				!Number.isFinite(input.discountRate ?? 0) ||
				(input.discountRate ?? 0) < 0 ||
				(input.discountRate ?? 0) > 100
			) {
				throw new Error('折扣必須介於 0 到 100。');
			}
			if (labelMode === 'edit' && selectedLabel) await updateBusinessLabel(selectedLabel.id, input);
			else await createBusinessLabel(input);
			closeLabel();
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法儲存企業標籤。');
		}
	}

	async function changeBusinessState(event: SubmitEvent, restore: boolean) {
		event.preventDefault();
		formError = '';
		const id = String(new FormData(event.currentTarget as HTMLFormElement).get('businessId') ?? '');
		try {
			if (restore) await restoreBusiness(id);
			else await deleteBusiness(id);
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法更新企業狀態。');
		}
	}

	async function changeLabelState(event: SubmitEvent, restore: boolean) {
		event.preventDefault();
		formError = '';
		const id = String(new FormData(event.currentTarget as HTMLFormElement).get('labelId') ?? '');
		try {
			if (restore) await restoreBusinessLabel(id);
			else await deleteBusinessLabel(id);
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法更新標籤狀態。');
		}
	}

	async function applyBulkLabel() {
		if (selectedIds.length === 0 || bulkBusy) return;
		formError = '';
		bulkBusy = true;
		try {
			await bulkUpdateBusinessLabel({ businessIds: selectedIds, labelId: bulkLabelId || null });
			selectedIds = [];
			bulkLabelId = '';
			await invalidateAll();
		} catch (error) {
			formError = apiMessage(error, '無法批次更新企業標籤。');
		} finally {
			bulkBusy = false;
		}
	}
</script>

<svelte:head><title>企業 | 管理後台</title></svelte:head>

<div class="space-y-5">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-xl font-semibold text-text-heading">企業管理</h1>
		{#if canWrite}
			<button
				type="button"
				class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-text-on-accent hover:bg-brand-hover"
				onclick={() => openBusiness()}
			>
				<Building2 class="size-4" />新增企業
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

	<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
		<section class="min-w-0 rounded-lg border border-border bg-bg-surface shadow-xs">
			<form
				class="flex flex-wrap items-center gap-2 border-b border-border p-4"
				onsubmit={(event) => event.preventDefault()}
				oninput={(event) => scheduleFilters('/businesses', event.currentTarget as HTMLFormElement)}
				onchange={(event) => applyFilters('/businesses', event.currentTarget as HTMLFormElement)}
			>
				<label class="relative min-w-0 flex-[1_1_16rem]">
					<Search class="pointer-events-none absolute left-3 top-3 size-4 text-text-muted" />
					<span class="sr-only">搜尋企業</span>
					<input
						name="search"
						value={page.url.searchParams.get('search') ?? ''}
						placeholder="搜尋企業名稱"
						class="h-10 w-full rounded-md border border-border bg-bg-surface pl-9 pr-3 text-sm"
					/>
				</label>
				<label class="min-w-36 flex-1">
					<span class="sr-only">企業標籤</span>
					<select
						name="labelId"
						class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
					>
						<option
							value=""
							selected={!page.url.searchParams.has('labelId')}
						>
							全部標籤
						</option>
						{#each activeLabels as label (label.id)}
							<option
								value={label.id}
								selected={page.url.searchParams.get('labelId') === label.id}
							>
								{label.name}
							</option>
						{/each}
					</select>
				</label>
				<label class="min-w-32 flex-1">
					<span class="sr-only">企業封存狀態</span>
					<select
						name="archived"
						class="h-10 w-full rounded-md border border-border bg-bg-surface px-3 text-sm"
					>
						<option
							value="false"
							selected={page.url.searchParams.get('archived') !== 'true'}
						>
							啟用中
						</option>
						<option
							value="true"
							selected={page.url.searchParams.get('archived') === 'true'}
						>
							已封存
						</option>
					</select>
				</label>
				<a
					href={resolve('/businesses')}
					class="inline-grid size-10 shrink-0 cursor-pointer place-items-center rounded-md border border-border"
					aria-label="重設篩選"
					title="重設篩選"
				>
					<RotateCcw class="size-4" />
				</a>
			</form>

			{#if selectedIds.length > 0}
				<div
					class="flex flex-wrap items-center gap-2 border-b border-border bg-bg-sunken px-4 py-3"
				>
					<span class="mr-auto text-sm font-semibold text-text-heading">
						已選取 {selectedIds.length} 家企業
					</span>
					<select
						bind:value={bulkLabelId}
						class="h-9 min-w-40 rounded-md border border-border bg-bg-surface px-3 text-sm"
						aria-label="批次套用標籤"
					>
						<option value="">移除標籤</option>
						{#each activeLabels as label (label.id)}<option value={label.id}>
								{label.name}
							</option>{/each}
					</select>
					<button
						type="button"
						class="h-9 cursor-pointer rounded-md bg-brand px-3 text-sm font-semibold text-text-on-accent hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
						disabled={bulkBusy}
						onclick={() => void applyBulkLabel()}
					>
						套用標籤
					</button>
				</div>
			{/if}

			<div class="overflow-x-auto">
				<table class="min-w-[760px] w-full text-left text-sm">
					<thead class="border-b border-border bg-bg-sunken text-xs text-text-muted">
						<tr>
							<th class="w-12 px-4 py-3">
								<input
									type="checkbox"
									aria-label="全選企業"
									checked={allSelected}
									disabled={!canWrite || selectableBusinesses.length === 0}
									onchange={(event) => toggleAll((event.currentTarget as HTMLInputElement).checked)}
								/>
							</th>
							<th class="px-4 py-3">企業</th>
							<th class="px-4 py-3">標籤</th>
							<th class="px-4 py-3">更新時間</th>
							<th class="px-4 py-3 text-right">操作</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.businesses as business (business.id)}
							<tr class="align-top">
								<td class="px-4 py-4">
									<input
										type="checkbox"
										aria-label={`選取${business.name}`}
										checked={selectedIds.includes(business.id)}
										disabled={!canWrite || business.isDeleted}
										onchange={(event) =>
											toggleSelected(
												business.id,
												(event.currentTarget as HTMLInputElement).checked
											)}
									/>
								</td>
								<td class="px-4 py-4">
									<strong class="block text-text-heading">{business.name}</strong>
									<span class="text-xs text-text-muted">
										{business.contactName ?? business.contactEmail ?? '未提供聯絡資料'}
									</span>
								</td>
								<td class="px-4 py-4 text-text-muted">
									{#if business.label}<span
											class="inline-flex items-center gap-2 text-text-heading"
										>
											<span
												class="size-2.5 rounded-full"
												style={`background-color: ${business.label.color}`}
											></span>
											{business.label.name}
										</span>{:else}未分類{/if}
								</td>
								<td class="whitespace-nowrap px-4 py-4 text-text-muted">
									{new Intl.DateTimeFormat('zh-TW', {
										dateStyle: 'medium',
										timeStyle: 'short',
										timeZone: 'Asia/Taipei'
									}).format(business.updatedAt)}
								</td>
								<td class="px-4 py-4">
									<div class="flex justify-end gap-2">
										{#if canWrite && !business.isDeleted}<button
												type="button"
												class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border"
												aria-label={`編輯${business.name}`}
												title="編輯企業"
												onclick={() => openBusiness(business)}
											>
												<Pencil class="size-4" />
											</button>{/if}
										{#if canWrite}<form
												onsubmit={(event) => changeBusinessState(event, business.isDeleted)}
											>
												<input
													type="hidden"
													name="businessId"
													value={business.id}
												/>
												<button
													type="submit"
													class="inline-grid size-9 cursor-pointer place-items-center rounded-md border border-border {business.isDeleted
														? ''
														: 'text-danger'}"
													aria-label={business.isDeleted
														? `還原${business.name}`
														: `封存${business.name}`}
													title={business.isDeleted ? '還原企業' : '封存企業'}
												>
													{#if business.isDeleted}<Undo2 class="size-4" />{:else}<Trash2
															class="size-4"
														/>{/if}
												</button>
											</form>{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination pagination={data.pagination} />
		</section>

		<BusinessLabels
			labels={data.labels}
			{canWrite}
			{labelView}
			onviewchange={(view) => (labelView = view)}
			onopen={(label) =>
				openLabel(label ? data.labels.find((item) => item.id === label.id) : undefined)}
			onstate={changeLabelState}
		/>
	</div>
</div>

<BusinessEditorDrawer
	open={businessMode !== null}
	mode={businessMode}
	business={selectedBusiness}
	labels={data.labels}
	onclose={closeBusiness}
	onsave={saveBusiness}
/>
<BusinessLabelEditorDrawer
	open={labelMode !== null}
	mode={labelMode}
	label={selectedLabel}
	color={labelColor}
	colors={labelColors}
	oncolorchange={(color) => (labelColor = color)}
	onclose={closeLabel}
	onsave={saveLabel}
/>
