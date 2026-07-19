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
	input(screen.container, '#email', 'ada@example.com');
	input(screen.container, '#message', 'Please send specifications.');
	turnstile.verify();
	submit(screen.container);

	await vi.waitFor(() => expect(submitRequest).toHaveBeenCalledOnce());
	expect(submitRequest).toHaveBeenCalledWith(
		'https://contact.example.com',
		expect.objectContaining({
			turnstileToken: 'verified-token',
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			message: 'Please send specifications.'
		})
	);
	await vi.waitFor(() =>
		expect(screen.container.querySelector<HTMLInputElement>('#name')?.value).toBe('')
	);
	expect(turnstile.renderWidget).toHaveBeenCalledTimes(2);
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
	input(screen.container, '#email', 'ada@example.com');
	input(screen.container, '#message', 'Please send specifications.');
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
