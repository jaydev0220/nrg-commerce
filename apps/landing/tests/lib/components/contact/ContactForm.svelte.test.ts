import { flushSync } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

import ContactForm from '$lib/components/contact/ContactForm.svelte';

type TurnstileCallbacks = {
	callback(token: string): void;
	'expired-callback'(): void;
	'error-callback'(): void;
};

function installTurnstile() {
	let callbacks: TurnstileCallbacks | undefined;
	const renderWidget = vi.fn((_container: HTMLElement, options: TurnstileCallbacks) => {
		callbacks = options;
		return `widget-${renderWidget.mock.calls.length}`;
	});
	Object.assign(window, {
		turnstile: { render: renderWidget, remove: vi.fn() }
	});
	return {
		renderWidget,
		verify(token = 'verified-token') {
			if (!callbacks) throw new Error('Turnstile widget was not rendered.');
			callbacks.callback(token);
			flushSync();
		},
		expire() {
			if (!callbacks) throw new Error('Turnstile widget was not rendered.');
			callbacks['expired-callback']();
			flushSync();
		},
		fail() {
			if (!callbacks) throw new Error('Turnstile widget was not rendered.');
			callbacks['error-callback']();
			flushSync();
		}
	};
}

function input(container: HTMLElement, selector: string, value: string) {
	const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
	if (!element) throw new Error(`Missing form field ${selector}.`);
	element.value = value;
	element.dispatchEvent(new Event('input', { bubbles: true }));
	return element;
}

function submit(container: HTMLElement) {
	const form = container.querySelector<HTMLFormElement>('form');
	if (!form) throw new Error('Missing contact form.');
	form.requestSubmit();
}

test('submits a verified contact request once and clears the form', async () => {
	const turnstile = installTurnstile();
	const submitRequest = vi.fn(async () => undefined);
	const screen = await render(ContactForm, {
		workerUrl: 'https://contact.example.com',
		turnstileSiteKey: 'site-key',
		submitRequest
	});

	await vi.waitFor(() => expect(turnstile.renderWidget).toHaveBeenCalledOnce());
	input(screen.container, '#name', 'Ada Lovelace');
	input(screen.container, '#company', 'Analytical Engines Ltd.');
	input(screen.container, '#email', 'ada@example.com');
	input(screen.container, '#phone', '+886 2 1234 5678');
	input(screen.container, '#product-interest', 'Precision components');
	input(screen.container, '#message', 'Please send specifications.');
	const inquiryType = screen.container.querySelector<HTMLSelectElement>('#inquiry-type');
	if (!inquiryType) throw new Error('Missing inquiry type field.');
	inquiryType.value = inquiryType.options[1]?.value ?? '';
	inquiryType.dispatchEvent(new Event('change', { bubbles: true }));
	turnstile.verify();
	submit(screen.container);

	await vi.waitFor(() => expect(submitRequest).toHaveBeenCalledOnce());
	expect(submitRequest).toHaveBeenCalledWith(
		'https://contact.example.com',
		expect.objectContaining({
			turnstileToken: 'verified-token',
			name: 'Ada Lovelace',
			company: 'Analytical Engines Ltd.',
			email: 'ada@example.com',
			phone: '+886 2 1234 5678',
			productInterest: 'Precision components',
			message: 'Please send specifications.'
		})
	);
	await vi.waitFor(() =>
		expect(screen.container.querySelector<HTMLInputElement>('#name')?.value).toBe('')
	);
	expect(turnstile.renderWidget).toHaveBeenCalledTimes(2);
});

test('renders one uniquely labelled control for every field', async () => {
	const turnstile = installTurnstile();
	const screen = await render(ContactForm, {
		workerUrl: 'https://contact.example.com',
		turnstileSiteKey: 'site-key',
		submitRequest: vi.fn(async () => undefined)
	});

	await vi.waitFor(() => expect(turnstile.renderWidget).toHaveBeenCalledOnce());
	expect(screen.container.querySelectorAll('form')).toHaveLength(1);
	const ids = Array.from(screen.container.querySelectorAll<HTMLElement>('[id]')).map(
		(element) => element.id
	);
	expect(new Set(ids).size).toBe(ids.length);
	for (const fieldId of [
		'name',
		'company',
		'email',
		'phone',
		'inquiry-type',
		'product-interest',
		'message'
	]) {
		expect(screen.container.querySelectorAll(`#${fieldId}`)).toHaveLength(1);
		expect(screen.container.querySelector(`label[for="${fieldId}"]`)).not.toBeNull();
	}

	submit(screen.container);
	await vi.waitFor(() => expect(document.activeElement?.id).toBe('name'));
});

test('preserves contact values and allows retry after delivery failure', async () => {
	const turnstile = installTurnstile();
	const submitRequest = vi.fn(async () => {
		throw new Error('delivery failed');
	});
	const screen = await render(ContactForm, {
		workerUrl: 'https://contact.example.com',
		turnstileSiteKey: 'site-key',
		submitRequest
	});

	await vi.waitFor(() => expect(turnstile.renderWidget).toHaveBeenCalledOnce());
	input(screen.container, '#name', 'Ada Lovelace');
	input(screen.container, '#email', 'ada@example.com');
	input(screen.container, '#message', 'Keep this message.');
	turnstile.verify();
	submit(screen.container);

	await vi.waitFor(() => expect(submitRequest).toHaveBeenCalledOnce());
	await vi.waitFor(() => expect(turnstile.renderWidget).toHaveBeenCalledTimes(2));
	expect(screen.container.querySelector<HTMLInputElement>('#name')?.value).toBe('Ada Lovelace');
	expect(screen.container.querySelector<HTMLTextAreaElement>('#message')?.value).toBe(
		'Keep this message.'
	);
	expect(screen.container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
		false
	);
});

test('only blocks page exit while an edited form is idle', async () => {
	const turnstile = installTurnstile();
	let finishRequest = () => {};
	const submitRequest = vi.fn(
		() =>
			new Promise<void>((resolve) => {
				finishRequest = resolve;
			})
	);
	const screen = await render(ContactForm, {
		workerUrl: 'https://contact.example.com',
		turnstileSiteKey: 'site-key',
		submitRequest
	});

	await vi.waitFor(() => expect(turnstile.renderWidget).toHaveBeenCalledOnce());
	const pristineUnload = new Event('beforeunload', { cancelable: true });
	window.dispatchEvent(pristineUnload);
	expect(pristineUnload.defaultPrevented).toBe(false);

	input(screen.container, '#name', 'Ada Lovelace');
	input(screen.container, '#email', 'ada@example.com');
	input(screen.container, '#message', 'Please send specifications.');
	const editedUnload = new Event('beforeunload', { cancelable: true });
	window.dispatchEvent(editedUnload);
	expect(editedUnload.defaultPrevented).toBe(true);

	turnstile.verify();
	submit(screen.container);
	await vi.waitFor(() => expect(submitRequest).toHaveBeenCalledOnce());
	const submittingUnload = new Event('beforeunload', { cancelable: true });
	window.dispatchEvent(submittingUnload);
	expect(submittingUnload.defaultPrevented).toBe(false);

	finishRequest();
	await vi.waitFor(() => expect(turnstile.renderWidget).toHaveBeenCalledTimes(2));
});

test('requires valid fields and a current Turnstile verification', async () => {
	const turnstile = installTurnstile();
	const submitRequest = vi.fn(async () => undefined);
	const screen = await render(ContactForm, {
		workerUrl: 'https://contact.example.com',
		turnstileSiteKey: 'site-key',
		submitRequest
	});

	await vi.waitFor(() => expect(turnstile.renderWidget).toHaveBeenCalledOnce());
	submit(screen.container);
	expect(submitRequest).not.toHaveBeenCalled();
	await vi.waitFor(() =>
		expect(screen.container.querySelectorAll('[aria-invalid="true"]').length).toBeGreaterThan(0)
	);

	input(screen.container, '#name', 'Ada Lovelace');
	input(screen.container, '#email', 'invalid-address');
	input(screen.container, '#message', 'Please send specifications.');
	submit(screen.container);
	await vi.waitFor(() => expect(document.activeElement?.id).toBe('email'));
	expect(submitRequest).not.toHaveBeenCalled();

	input(screen.container, '#email', 'ada@example.com');
	turnstile.verify();
	turnstile.expire();
	submit(screen.container);
	expect(submitRequest).not.toHaveBeenCalled();

	turnstile.fail();
	expect(
		Array.from(screen.container.querySelectorAll('[aria-live="polite"]')).some((element) =>
			Boolean(element.textContent?.trim())
		)
	).toBe(true);
	turnstile.verify('fresh-token');
	submit(screen.container);
	await vi.waitFor(() => expect(submitRequest).toHaveBeenCalledOnce());
	expect(submitRequest).toHaveBeenCalledWith(
		'https://contact.example.com',
		expect.objectContaining({ turnstileToken: 'fresh-token' })
	);
});
