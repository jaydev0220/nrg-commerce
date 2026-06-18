<script lang="ts">
	import { browser } from '$app/environment';
	import * as m from '$lib/paraglide/messages';
	import { page } from '$app/state';

	function mapInquiryType(queryType: string | null): string {
		switch (queryType) {
			case 'b2b':
				return m.form_inquiry_b2b();
			case 'b2c':
				return m.form_inquiry_b2c();
			default:
				return '';
		}
	}

	const initialInquiryType = browser ? page.url.searchParams.get('type') : null;

	let form = $state({
		name: '',
		company: '',
		email: '',
		phone: '',
		inquiryType: mapInquiryType(initialInquiryType),
		productInterest: '',
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

	function validateForm(): boolean {
		errors.name = form.name.trim() ? '' : m.form_error_name_required();
		errors.email = form.email.trim()
			? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
				? ''
				: m.form_error_email_invalid()
			: m.form_error_email_required();
		errors.message = form.message.trim() ? '' : m.form_error_message_required();

		return !errors.name && !errors.email && !errors.message;
	}

	function focusFirstInvalidField() {
		const invalidFieldOrder: Array<'name' | 'email' | 'message'> = ['name', 'email', 'message'];
		const firstInvalidFieldName = invalidFieldOrder.find((fieldName) => Boolean(errors[fieldName]));
		if (!firstInvalidFieldName) return;

		const matchingInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
			`[name="${firstInvalidFieldName}"]`
		);
		const visibleInput = Array.from(matchingInputs).find((input) => input.offsetParent !== null);
		visibleInput?.focus();
	}

	const hasUnsavedChanges = $derived(
		Boolean(
			form.name ||
			form.company ||
			form.email ||
			form.phone ||
			form.inquiryType ||
			form.productInterest ||
			form.message
		)
	);

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (!hasUnsavedChanges || isSubmitting) return;
		event.preventDefault();
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		statusMessage = '';
		statusTone = '';

		if (!validateForm()) {
			statusTone = 'error';
			statusMessage = m.form_status_fix_errors();
			focusFirstInvalidField();
			return;
		}

		isSubmitting = true;

		try {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			statusTone = 'success';
			statusMessage = m.form_submit_success();

			form = {
				name: '',
				company: '',
				email: '',
				phone: '',
				inquiryType: '',
				productInterest: '',
				message: ''
			};
		} catch (error) {
			console.error('Submission error:', error);
			statusTone = 'error';
			statusMessage = m.form_submit_error();
		} finally {
			isSubmitting = false;
		}
	}

	const inquiryOptions = [
		{ id: 'default', value: '', label: () => m.form_inquiry_type() },
		{ id: 'b2b', value: m.form_inquiry_b2b(), label: () => m.form_inquiry_b2b() },
		{ id: 'b2c', value: m.form_inquiry_b2c(), label: () => m.form_inquiry_b2c() },
		{ id: 'other', value: m.form_inquiry_other(), label: () => m.form_inquiry_other() }
	];
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<div>
	<h2 class="mb-4 text-2xl font-bold text-text-heading md:text-xl lg:text-2xl">
		{m.form_heading()}
	</h2>
	<div class="mb-6 border-t border-border"></div>

	<form onsubmit={handleSubmit} class="space-y-6" novalidate>
		<!-- Desktop/Tablet: Two column layout -->
		<div class="hidden gap-4 md:grid md:grid-cols-2">
			<!-- Full Name -->
			<div>
				<label for="name" class="mb-2 block text-sm font-medium text-text-body">
					{m.form_name_required()}
				</label>
				<input
					id="name"
					name="name"
					type="text"
					bind:value={form.name}
					autocomplete="name"
					required
					aria-invalid={Boolean(errors.name)}
					aria-describedby={errors.name ? 'name-error' : undefined}
					class="
						w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
						focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
						{errors.name ? 'border-red-500' : ''}
					"
				/>
				{#if errors.name}
					<p id="name-error" class="mt-1 text-xs text-red-600">{errors.name}</p>
				{/if}
			</div>

			<!-- Company Name -->
			<div>
				<label for="company" class="mb-2 block text-sm font-medium text-text-body">
					{m.form_company()}
				</label>
				<input
					id="company"
					name="company"
					type="text"
					bind:value={form.company}
					autocomplete="organization"
					class="
						w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
						focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					"
				/>
			</div>
		</div>

		<!-- Email and Phone -->
		<div class="hidden gap-4 md:grid md:grid-cols-2">
			<!-- Email -->
			<div>
				<label for="email" class="mb-2 block text-sm font-medium text-text-body">
					{m.form_email_required()}
				</label>
				<input
					id="email"
					name="email"
					type="email"
					bind:value={form.email}
					inputmode="email"
					autocomplete="off"
					spellcheck={false}
					required
					aria-invalid={Boolean(errors.email)}
					aria-describedby={errors.email ? 'email-error' : undefined}
					class="
						w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
						focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
						{errors.email ? 'border-red-500' : ''}
					"
				/>
				{#if errors.email}
					<p id="email-error" class="mt-1 text-xs text-red-600">{errors.email}</p>
				{/if}
			</div>

			<!-- Phone -->
			<div>
				<label for="phone" class="mb-2 block text-sm font-medium text-text-body">
					{m.form_phone()}
				</label>
				<input
					id="phone"
					name="phone"
					type="tel"
					bind:value={form.phone}
					autocomplete="tel"
					inputmode="tel"
					class="
						w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
						focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					"
				/>
			</div>
		</div>

		<!-- Mobile: Single column layout -->
		<div class="space-y-4 md:hidden">
			<!-- Full Name -->
			<div>
				<label for="name-mobile" class="mb-2 block text-sm font-medium text-text-body">
					{m.form_name_required()}
				</label>
				<input
					id="name-mobile"
					name="name"
					type="text"
					bind:value={form.name}
					autocomplete="name"
					required
					aria-invalid={Boolean(errors.name)}
					aria-describedby={errors.name ? 'name-error-mobile' : undefined}
					class="
						w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
						focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
						{errors.name ? 'border-red-500' : ''}
					"
				/>
				{#if errors.name}
					<p id="name-error-mobile" class="mt-1 text-xs text-red-600">{errors.name}</p>
				{/if}
			</div>

			<!-- Company Name -->
			<div>
				<label for="company-mobile" class="mb-2 block text-sm font-medium text-text-body">
					{m.form_company()}
				</label>
				<input
					id="company-mobile"
					name="company"
					type="text"
					bind:value={form.company}
					autocomplete="organization"
					class="
						w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
						focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					"
				/>
			</div>

			<!-- Email -->
			<div>
				<label for="email-mobile" class="mb-2 block text-sm font-medium text-text-body">
					{m.form_email_required()}
				</label>
				<input
					id="email-mobile"
					name="email"
					type="email"
					bind:value={form.email}
					inputmode="email"
					autocomplete="off"
					spellcheck={false}
					required
					aria-invalid={Boolean(errors.email)}
					aria-describedby={errors.email ? 'email-error-mobile' : undefined}
					class="
						w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
						focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
						{errors.email ? 'border-red-500' : ''}
					"
				/>
				{#if errors.email}
					<p id="email-error-mobile" class="mt-1 text-xs text-red-600">{errors.email}</p>
				{/if}
			</div>

			<!-- Phone -->
			<div>
				<label for="phone-mobile" class="mb-2 block text-sm font-medium text-text-body">
					{m.form_phone()}
				</label>
				<input
					id="phone-mobile"
					name="phone"
					type="tel"
					bind:value={form.phone}
					autocomplete="tel"
					inputmode="tel"
					class="
						w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
						focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					"
				/>
			</div>
		</div>

		<!-- Inquiry Type (Full Width) -->
		<div>
			<label for="inquiry-type" class="mb-2 block text-sm font-medium text-text-body">
				{m.form_inquiry_type()}
			</label>
			<select
				id="inquiry-type"
				name="inquiryType"
				bind:value={form.inquiryType}
				autocomplete="off"
				class="
					w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
					focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
				"
			>
				{#each inquiryOptions as option (option.id)}
					<option value={option.value}>{option.label()}</option>
				{/each}
			</select>
		</div>

		<!-- Product Interest (Full Width) -->
		<div>
			<label for="product-interest" class="mb-2 block text-sm font-medium text-text-body">
				{m.form_product_interest()}
			</label>
			<input
				id="product-interest"
				name="productInterest"
				type="text"
				bind:value={form.productInterest}
				autocomplete="off"
				class="
					w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
					focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
				"
			/>
		</div>

		<!-- Message (Full Width) -->
		<div>
			<label for="message" class="mb-2 block text-sm font-medium text-text-body">
				{m.form_message_required()}
			</label>
			<textarea
				id="message"
				name="message"
				bind:value={form.message}
				required
				rows="6"
				autocomplete="off"
				aria-invalid={Boolean(errors.message)}
				aria-describedby={errors.message ? 'message-error' : undefined}
				class="
					w-full resize-none rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm
					focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none
					{errors.message ? 'border-red-500' : ''}
				"
			></textarea>
			{#if errors.message}
				<p id="message-error" class="mt-1 text-xs text-red-600">{errors.message}</p>
			{/if}
		</div>

		<!-- Submit Button -->
		<div>
			<button
				type="submit"
				disabled={isSubmitting}
				class="
					h-12 w-full rounded-md bg-brand px-6 py-3 text-sm font-medium text-text-on-accent transition-colors duration-200
					hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand
					focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-text-muted
				"
			>
				{isSubmitting ? m.form_submitting() : m.form_submit()}
			</button>
		</div>

		{#if statusMessage}
			<p
				class={`
					text-sm
					${statusTone === 'error' ? 'text-red-600' : 'text-success'}
				`}
				aria-live="polite"
			>
				{statusMessage}
			</p>
		{/if}

		<!-- Required Fields Note -->
		<p class="text-xs text-text-muted">
			{m.form_required_note()}
		</p>
	</form>
</div>

<style>
	form {
		--ease-ui: cubic-bezier(0.4, 0, 0.2, 1);
		--duration-base: 180ms;
	}
</style>
