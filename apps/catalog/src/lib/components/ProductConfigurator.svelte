<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { Send } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import type { CatalogLocale, ProductConfigurationModel } from '$lib/catalog/types.js';
	import { formatMoney } from '$lib/catalog/ui.js';

	type Props = {
		locale: CatalogLocale;
		categoryLabel: string | null;
		productName: string;
		productSkuCount: number;
		model: ProductConfigurationModel;
		inquiryHref: string;
		onSelectOption: (key: string, value: string) => void;
	};

	let {
		locale,
		categoryLabel,
		productName,
		productSkuCount,
		model,
		inquiryHref,
		onSelectOption
	}: Props = $props();
</script>

<article class="rounded-lg border border-border bg-bg-surface p-5 shadow-xs sm:p-7">
	{#if categoryLabel}
		<p class="text-xs font-semibold text-text-accent">{categoryLabel}</p>
	{/if}
	<div class="mt-2 flex items-center gap-2">
		<span class="rounded-sm bg-brand-subtle px-2 py-1 font-mono text-[10px] text-text-accent">
			{productSkuCount}
			{productSkuCount === 1 ? m.catalog_configuration() : m.catalog_configurations()}
		</span>
	</div>
	<h1 class="mt-4 text-4xl tracking-tight sm:text-5xl">{productName}</h1>

	<section
		class="mt-8 border-t border-border pt-7"
		aria-labelledby="spec-selector-title"
	>
		<div>
			<p class="font-mono text-[10px] uppercase tracking-caps text-text-accent">
				{m.catalog_configure_label()}
			</p>
			<h2
				id="spec-selector-title"
				class="mt-1 text-xl tracking-normal"
			>
				{m.catalog_choose_specs()}
			</h2>
		</div>

		<div class="mt-6 space-y-6">
			{#each model.optionGroups as group (group.key)}
				<fieldset>
					<legend class="mb-2 text-sm font-semibold text-text-heading">{group.label}</legend>
					<div class="flex flex-wrap gap-2">
						{#each group.options as option (option.value)}
							<button
								type="button"
								role="radio"
								aria-checked={option.selected}
								disabled={!option.available}
								class={`min-h-10 rounded-md border px-3 py-2 text-left font-mono text-xs font-semibold transition-[color,background-color,border-color,transform,opacity] duration-base ease-ui ${option.selected ? 'border-brand bg-brand text-text-on-accent shadow-xs' : 'border-border-strong bg-bg-surface text-text-body hover:-translate-y-0.5 hover:border-border-accent hover:bg-brand-subtle'} ${option.available ? '' : 'cursor-not-allowed opacity-35'}`}
								onclick={() => onSelectOption(group.key, option.value)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				</fieldset>
			{/each}
		</div>
	</section>

	<div class="mt-8 rounded-lg border border-border-accent bg-bg-accent p-5">
		<div class="grid gap-5 sm:grid-cols-2">
			<div>
				<p class="text-[10px] uppercase tracking-caps text-text-muted">
					{m.catalog_selected_sku()}
				</p>
				<p class="mt-1 font-mono text-sm font-semibold text-text-heading">
					{model.activeSku.skuCode}
				</p>
			</div>
			<div class="sm:text-right">
				<p class="text-[10px] uppercase tracking-caps text-text-muted">{m.catalog_price()}</p>
				<p class="mt-1 font-mono text-3xl font-semibold text-text-heading">
					{formatMoney(locale, model.activeSku.price)}
				</p>
			</div>
		</div>
		<p
			class="mt-4 border-t border-border-accent pt-4 text-xs leading-relaxed text-text-muted"
			aria-live="polite"
		>
			{m.catalog_available_configuration()} ·
			{#each model.selectedAttributeEntries as entry, index (entry.key)}
				{#if index > 0}
					·
				{/if}
				{entry.label}: {entry.valueLabel}
			{/each}
		</p>
		<a
			href={resolve(inquiryHref as Pathname)}
			class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-semibold text-text-on-accent transition-[color,background-color,transform] duration-base ease-ui hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
		>
			<Send class="size-4" />
			{m.catalog_inquiry_cta()}
		</a>
	</div>
</article>
