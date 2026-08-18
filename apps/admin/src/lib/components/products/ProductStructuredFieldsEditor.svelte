<script lang="ts">
	import { untrack } from 'svelte';
	import {
		generateStructuredData,
		structuredDataUnitValues,
		structuredFieldPresets,
		structuredFieldsSchema,
		type StructuredFields,
		type StructuredFieldPreset
	} from '@packages/product-structured-data';

	let {
		value = $bindable<StructuredFields>({}),
		attributes,
		onvalidationchange
	}: {
		value?: StructuredFields;
		attributes: Record<string, unknown>;
		onvalidationchange?: (message: string) => void;
	} = $props();

	type DraftValue = Record<string, unknown>;
	type CustomDraft = { id: number; name: string; value: string };

	let selectedKeys = $state<string[]>(
		untrack(() => Object.keys(value).filter((key) => key !== 'additionalProperties'))
	);
	let draftValues = $state<DraftValue>({ ...value });
	let customRows = $state<CustomDraft[]>(
		untrack(() =>
			(value.additionalProperties ?? []).map((property, index) => ({ ...property, id: index }))
		)
	);
	let nextCustomId = $state(untrack(() => customRows.length));
	let validationMessage = $state('');

	const groupedPresets = $derived(
		(['variant', 'identifier', 'physical', 'laboratory'] as const).map((group) => ({
			group,
			presets: structuredFieldPresets.filter(
				(preset) => preset.group === group && preset.key !== 'custom'
			)
		}))
	);
	const preview = $derived(
		generateStructuredData({ attributes, structuredFields: value }).fragment
	);

	const groupLabels: Record<string, string> = {
		variant: '變體欄位',
		identifier: '識別欄位',
		physical: '物理尺寸',
		laboratory: '實驗室欄位'
	};

	function presetFor(key: string): StructuredFieldPreset | undefined {
		return structuredFieldPresets.find((preset) => preset.key === key);
	}

	function normalizedKey(key: string): string {
		return key
			.trim()
			.toLowerCase()
			.replace(/[\s_-]+/g, '');
	}

	function attributeValueFor(key: string): string | null {
		const normalized = normalizedKey(key);
		const entry = Object.entries(attributes).find(
			([attributeKey]) => normalizedKey(attributeKey) === normalized
		);
		return entry ? String(entry[1]) : null;
	}

	function fieldValue(key: string): unknown {
		return draftValues[key];
	}

	function commit(nextValues: DraftValue = draftValues, nextCustom = customRows) {
		const candidate = {
			...nextValues,
			...(nextCustom.length > 0
				? {
						additionalProperties: nextCustom.map(({ name, value: propertyValue }) => ({
							name,
							value: propertyValue
						}))
					}
				: {})
		};
		const parsed = structuredFieldsSchema.safeParse(candidate);
		if (!parsed.success) {
			validationMessage = parsed.error.issues[0]?.message ?? '欄位格式不正確。';
			onvalidationchange?.(validationMessage);
			return;
		}
		validationMessage = '';
		onvalidationchange?.('');
		value = parsed.data;
	}

	function updateField(key: string, next: unknown) {
		draftValues = { ...draftValues, [key]: next };
		commit(draftValues, customRows);
	}

	function addPreset(key: string) {
		if (key === 'custom') {
			addCustom();
			return;
		}
		if (selectedKeys.includes(key)) return;
		const preset = presetFor(key);
		if (!preset) return;
		selectedKeys = [...selectedKeys, key];
		const initialValue =
			preset.kind === 'measurement'
				? key === 'temperatureRange'
					? { minValue: 0, maxValue: 0, unitCode: 'CEL', unitText: '°C' }
					: { value: 0, unitCode: 'MLT', unitText: 'mL' }
				: preset.kind === 'boolean'
					? false
					: preset.kind === 'enum'
						? 'non-sterile'
						: '';
		draftValues = { ...draftValues, [key]: initialValue };
		commit({ ...draftValues, [key]: initialValue }, customRows);
	}

	function removePreset(key: string) {
		selectedKeys = selectedKeys.filter((selectedKey) => selectedKey !== key);
		const nextValues = { ...draftValues };
		delete nextValues[key];
		draftValues = nextValues;
		commit(nextValues, customRows);
	}

	function addCustom() {
		customRows = [...customRows, { id: nextCustomId, name: '', value: '' }];
		nextCustomId += 1;
		commit(draftValues, customRows);
	}

	function updateCustom(index: number, field: 'name' | 'value', next: string) {
		customRows = customRows.map((row, rowIndex) =>
			rowIndex === index ? { ...row, [field]: next } : row
		);
		commit(draftValues, customRows);
	}

	function removeCustom(index: number) {
		customRows = customRows.filter((_, rowIndex) => rowIndex !== index);
		commit(draftValues, customRows);
	}

	function updateMeasurement(
		key: string,
		field: 'value' | 'minValue' | 'maxValue' | 'unitCode',
		raw: string
	) {
		const current = (fieldValue(key) as Record<string, unknown> | undefined) ?? {};
		const next = {
			...current,
			[field]: field === 'unitCode' ? raw : raw === '' ? undefined : Number(raw)
		};
		if (field === 'value') {
			delete next['minValue'];
			delete next['maxValue'];
		}
		if (field === 'minValue' || field === 'maxValue') delete next['value'];
		updateField(key, next);
	}

	function measurementUnitValue(key: string): string {
		return String((fieldValue(key) as Record<string, unknown> | undefined)?.['unitCode'] ?? 'MLT');
	}

	function measurementValue(key: string, field: 'value' | 'minValue' | 'maxValue'): string {
		const value = (fieldValue(key) as Record<string, unknown> | undefined)?.[field];
		return value === undefined ? '' : String(value);
	}
</script>

<details class="rounded-md border border-border bg-bg-sunken p-3">
	<summary class="cursor-pointer text-sm font-medium">進階結構化資料</summary>
	<div class="mt-3 space-y-3">
		<p class="text-xs text-text-muted">
			這些欄位只用於產品 JSON-LD；顧客頁面的規格仍以規格屬性為準。
		</p>
		<label class="block text-sm font-medium">
			新增欄位
			<select
				class="mt-1 h-10 w-full rounded-md border border-border bg-bg-surface px-3"
				value=""
				onchange={(event) => {
					const key = (event.currentTarget as HTMLSelectElement).value;
					if (key) addPreset(key);
				}}
			>
				<option value="">選擇預設欄位或自訂欄位</option>
				{#each groupedPresets as group (group.group)}
					<optgroup label={groupLabels[group.group]}>
						{#each group.presets.filter((preset) => !selectedKeys.includes(preset.key)) as preset (preset.key)}
							<option value={preset.key}>{preset.label}</option>
						{/each}
					</optgroup>
				{/each}
				<option value="custom">自訂 PropertyValue</option>
			</select>
		</label>

		{#each selectedKeys as key (key)}
			{@const preset = presetFor(key)}
			{#if preset}
				<div class="rounded-md border border-border bg-bg-surface p-3">
					<div class="mb-2 flex items-center justify-between gap-2">
						<span class="text-sm font-medium">{preset.label}</span>
						<button
							type="button"
							class="text-xs text-danger"
							onclick={() => removePreset(key)}
						>
							移除
						</button>
					</div>
					{#if attributeValueFor(key)}
						<p class="mb-2 text-xs text-text-muted">規格屬性值：{attributeValueFor(key)}</p>
					{/if}
					{#if preset.kind === 'measurement'}
						<div class="grid gap-2 sm:grid-cols-3">
							{#if key === 'temperatureRange'}
								<input
									type="number"
									value={measurementValue(key, 'minValue')}
									placeholder="最小值"
									aria-label="最小值"
									oninput={(event) =>
										updateMeasurement(
											key,
											'minValue',
											(event.currentTarget as HTMLInputElement).value
										)}
									class="h-10 rounded-md border border-border px-3"
								/>
								<input
									type="number"
									value={measurementValue(key, 'maxValue')}
									placeholder="最大值"
									aria-label="最大值"
									oninput={(event) =>
										updateMeasurement(
											key,
											'maxValue',
											(event.currentTarget as HTMLInputElement).value
										)}
									class="h-10 rounded-md border border-border px-3"
								/>
							{:else}
								<input
									type="number"
									value={measurementValue(key, 'value')}
									placeholder="數值"
									aria-label="數值"
									oninput={(event) =>
										updateMeasurement(
											key,
											'value',
											(event.currentTarget as HTMLInputElement).value
										)}
									class="h-10 rounded-md border border-border px-3 sm:col-span-2"
								/>
							{/if}
							<select
								value={measurementUnitValue(key)}
								onchange={(event) =>
									updateMeasurement(
										key,
										'unitCode',
										(event.currentTarget as HTMLSelectElement).value
									)}
								class="h-10 rounded-md border border-border px-3"
							>
								{#each structuredDataUnitValues as unit (unit.unitCode)}
									<option value={unit.unitCode}>{unit.label}</option>
								{/each}
							</select>
						</div>
					{:else if preset.kind === 'boolean'}
						<select
							value={String(fieldValue(key))}
							onchange={(event) =>
								updateField(key, (event.currentTarget as HTMLSelectElement).value === 'true')}
							class="h-10 w-full rounded-md border border-border px-3"
						>
							<option value="true">是</option>
							<option value="false">否</option>
						</select>
					{:else if preset.kind === 'enum'}
						<select
							value={String(fieldValue(key) ?? '')}
							onchange={(event) =>
								updateField(key, (event.currentTarget as HTMLSelectElement).value)}
							class="h-10 w-full rounded-md border border-border px-3"
						>
							<option value="sterile">無菌</option>
							<option value="non-sterile">非無菌</option>
							<option value="aseptic">無菌操作</option>
						</select>
					{:else}
						<input
							type="text"
							value={String(fieldValue(key) ?? '')}
							maxlength={preset.kind === 'identifier' ? 14 : 500}
							oninput={(event) => updateField(key, (event.currentTarget as HTMLInputElement).value)}
							class="h-10 w-full rounded-md border border-border px-3"
						/>
					{/if}
				</div>
			{/if}
		{/each}

		{#each customRows as row, index (row.id)}
			<div class="grid grid-cols-[1fr_1fr_auto] gap-2">
				<input
					type="text"
					value={row.name}
					maxlength="100"
					placeholder="名稱"
					aria-label="自訂欄位名稱"
					oninput={(event) =>
						updateCustom(index, 'name', (event.currentTarget as HTMLInputElement).value)}
					class="h-10 rounded-md border border-border bg-bg-surface px-3"
				/>
				<input
					type="text"
					value={row.value}
					maxlength="500"
					placeholder="值"
					aria-label="自訂欄位值"
					oninput={(event) =>
						updateCustom(index, 'value', (event.currentTarget as HTMLInputElement).value)}
					class="h-10 rounded-md border border-border bg-bg-surface px-3"
				/>
				<button
					type="button"
					class="text-xs text-danger"
					aria-label="移除自訂欄位"
					onclick={() => removeCustom(index)}
				>
					移除
				</button>
			</div>
		{/each}

		<button
			type="button"
			class="text-sm text-text-accent"
			onclick={addCustom}
		>
			新增自訂欄位
		</button>
		{#if validationMessage}
			<p
				class="rounded-md border border-danger/30 bg-danger-bg p-2 text-xs text-danger"
				role="alert"
			>
				{validationMessage}
			</p>
		{/if}
		<details class="rounded-md border border-border p-2">
			<summary class="cursor-pointer text-xs text-text-muted">預覽產生的 SKU JSON-LD 片段</summary>
			<pre class="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap">{JSON.stringify(
					preview,
					null,
					2
				)}</pre>
		</details>
	</div>
</details>
