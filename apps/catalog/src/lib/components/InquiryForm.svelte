<script lang="ts">
	import * as publicEnv from '$env/static/public';
	import * as m from '$lib/paraglide/messages';
	import { TurnstileWidget } from '@packages/components';
	import { submitInquiryRequest, type InquiryRequestPayload } from '$lib/inquiry-request.js';

	const publicEnvironment = publicEnv as Record<string, string | undefined>;

	type Props = {
		initialSkuCode: string;
		workerUrl?: string;
		turnstileSiteKey?: string;
		submitRequest?: (workerUrl: string, payload: InquiryRequestPayload) => Promise<void>;
	};

	let {
		initialSkuCode,
		workerUrl = publicEnvironment['PUBLIC_CONTACT_WORKER_URL']?.trim() ?? '',
		turnstileSiteKey = publicEnvironment['PUBLIC_TURNSTILE_SITE_KEY']?.trim() ?? '',
		submitRequest = submitInquiryRequest
	}: Props = $props();

	let form = $state({
		name: '',
		company: '',
		email: '',
		phone: '',
		message: ''
	});
	let errors = $state({
		name: '',
		email: '',
		message: ''
	});
	let isSubmitting = $state(false);
	let statusMessage = $state('');
	let statusTone = $state<'success' | 'error' | ''>('');
	let skuCode = $derived(initialSkuCode);
	let turnstileToken = $state('');
	let turnstileGeneration = $state(0);
	let turnstileError = $state('');

	function handleTurnstileVerification(value: string) {
		turnstileToken = value;
		turnstileError = '';
	}

	function handleTurnstileExpiration() {
		turnstileToken = '';
	}

	function handleTurnstileError() {
		turnstileToken = '';
		turnstileError = m.inquiry_turnstile_error();
	}

	function validateForm(): boolean {
		errors.name = form.name.trim() ? '' : m.inquiry_error_name_required();
		errors.email = form.email.trim()
			? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
				? ''
				: m.inquiry_error_email_invalid()
			: m.inquiry_error_email_required();
		errors.message = form.message.trim() ? '' : m.inquiry_error_message_required();

		return !errors.name && !errors.email && !errors.message;
	}

	function focusFirstInvalidField() {
		const invalidFieldOrder: Array<'name' | 'email' | 'message'> = ['name', 'email', 'message'];
		const firstInvalidFieldName = invalidFieldOrder.find((fieldName) => Boolean(errors[fieldName]));
		if (!firstInvalidFieldName) {
			return;
		}

		document
			.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${firstInvalidFieldName}"]`)
			?.focus();
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		statusMessage = '';
		statusTone = '';

		if (!validateForm()) {
			statusTone = 'error';
			statusMessage = m.inquiry_status_fix_errors();
			focusFirstInvalidField();
			return;
		}
		if (!turnstileToken) {
			statusTone = 'error';
			statusMessage = m.inquiry_turnstile_required();
			return;
		}

		isSubmitting = true;

		try {
			await submitRequest(workerUrl, {
				turnstileToken,
				name: form.name.trim(),
				email: form.email.trim(),
				company: form.company.trim() || undefined,
				phone: form.phone.trim() || undefined,
				skuCode: skuCode.trim() || undefined,
				message: form.message.trim()
			});
			statusTone = 'success';
			statusMessage = m.inquiry_submit_success();
			form = { name: '', company: '', email: '', phone: '', message: '' };
			skuCode = '';
		} catch {
			statusTone = 'error';
			statusMessage = m.inquiry_submit_error();
		} finally {
			isSubmitting = false;
			turnstileToken = '';
			turnstileGeneration += 1;
		}
	}
</script>

<form
	onsubmit={handleSubmit}
	class="rounded-lg border border-border bg-bg-surface p-5 shadow-xs sm:p-7"
	novalidate
>
	<div class="mb-6">
		<p class="font-mono text-[10px] uppercase tracking-caps text-text-accent">
			{m.inquiry_eyebrow()}
		</p>
		<h1 class="mt-2 text-3xl tracking-tight sm:text-4xl">{m.inquiry_form_heading()}</h1>
	</div>

	<div class="grid gap-5 sm:grid-cols-2">
		<div>
			<label
				for="inquiry-name"
				class="mb-2 block text-sm font-semibold text-text-heading"
			>
				{m.inquiry_name_required()}
			</label>
			<input
				id="inquiry-name"
				name="name"
				type="text"
				bind:value={form.name}
				autocomplete="name"
				required
				aria-invalid={Boolean(errors.name)}
				aria-describedby={errors.name ? 'inquiry-name-error' : undefined}
				class={`w-full rounded-md border bg-bg-sunken px-3 py-2.5 text-sm text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${errors.name ? 'border-red-500' : 'border-border'}`}
			/>
			{#if errors.name}
				<p
					id="inquiry-name-error"
					class="mt-1 text-xs text-red-600"
				>
					{errors.name}
				</p>
			{/if}
		</div>

		<div>
			<label
				for="inquiry-company"
				class="mb-2 block text-sm font-semibold text-text-heading"
			>
				{m.inquiry_company()}
			</label>
			<input
				id="inquiry-company"
				name="company"
				type="text"
				bind:value={form.company}
				autocomplete="organization"
				class="w-full rounded-md border border-border bg-bg-sunken px-3 py-2.5 text-sm text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
			/>
		</div>

		<div>
			<label
				for="inquiry-email"
				class="mb-2 block text-sm font-semibold text-text-heading"
			>
				{m.inquiry_email_required()}
			</label>
			<input
				id="inquiry-email"
				name="email"
				type="email"
				bind:value={form.email}
				inputmode="email"
				autocomplete="email"
				spellcheck={false}
				required
				aria-invalid={Boolean(errors.email)}
				aria-describedby={errors.email ? 'inquiry-email-error' : undefined}
				class={`w-full rounded-md border bg-bg-sunken px-3 py-2.5 text-sm text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${errors.email ? 'border-red-500' : 'border-border'}`}
			/>
			{#if errors.email}
				<p
					id="inquiry-email-error"
					class="mt-1 text-xs text-red-600"
				>
					{errors.email}
				</p>
			{/if}
		</div>

		<div>
			<label
				for="inquiry-phone"
				class="mb-2 block text-sm font-semibold text-text-heading"
			>
				{m.inquiry_phone()}
			</label>
			<input
				id="inquiry-phone"
				name="phone"
				type="tel"
				bind:value={form.phone}
				autocomplete="tel"
				inputmode="tel"
				class="w-full rounded-md border border-border bg-bg-sunken px-3 py-2.5 text-sm text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
			/>
		</div>
	</div>

	<div class="mt-5">
		<label
			for="inquiry-sku"
			class="mb-2 block text-sm font-semibold text-text-heading"
		>
			{m.inquiry_sku()}
		</label>
		<input
			id="inquiry-sku"
			name="skuCode"
			type="text"
			bind:value={skuCode}
			autocomplete="off"
			placeholder={m.inquiry_sku_placeholder()}
			class="w-full rounded-md border border-border bg-bg-sunken px-3 py-2.5 font-mono text-sm text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
		/>
	</div>

	<div class="mt-5">
		<label
			for="inquiry-message"
			class="mb-2 block text-sm font-semibold text-text-heading"
		>
			{m.inquiry_message_required()}
		</label>
		<textarea
			id="inquiry-message"
			name="message"
			bind:value={form.message}
			required
			rows="7"
			autocomplete="off"
			placeholder={m.inquiry_message_placeholder()}
			aria-invalid={Boolean(errors.message)}
			aria-describedby={errors.message ? 'inquiry-message-error' : undefined}
			class={`w-full resize-y rounded-md border bg-bg-sunken px-3 py-2.5 text-sm leading-relaxed text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${errors.message ? 'border-red-500' : 'border-border'}`}></textarea>
		{#if errors.message}
			<p
				id="inquiry-message-error"
				class="mt-1 text-xs text-red-600"
			>
				{errors.message}
			</p>
		{/if}
	</div>

	<div class="mt-6">
		{#key turnstileGeneration}
			<TurnstileWidget
				siteKey={turnstileSiteKey}
				action="inquiry"
				label={m.inquiry_turnstile_label()}
				onverify={handleTurnstileVerification}
				onexpire={handleTurnstileExpiration}
				onerror={handleTurnstileError}
			/>
		{/key}
		{#if turnstileError}
			<p
				class="mt-2 text-sm text-red-600"
				aria-live="polite"
			>
				{turnstileError}
			</p>
		{/if}
	</div>

	<div class="mt-4">
		<button
			type="submit"
			disabled={isSubmitting}
			class="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-sm font-semibold text-text-on-accent transition-[background-color,transform] duration-base ease-ui hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-text-muted"
		>
			{isSubmitting ? m.inquiry_submitting() : m.inquiry_submit()}
		</button>
	</div>

	{#if statusMessage}
		<p
			class={`mt-4 text-sm ${statusTone === 'error' ? 'text-red-600' : 'text-text-accent'}`}
			aria-live="polite"
		>
			{statusMessage}
		</p>
	{/if}

	<p class="mt-4 text-xs leading-relaxed text-text-muted">{m.inquiry_required_note()}</p>
</form>
