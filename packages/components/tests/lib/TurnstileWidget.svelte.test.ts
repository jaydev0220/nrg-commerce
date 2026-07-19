import { render } from 'vitest-browser-svelte';
import { afterEach, expect, test, vi } from 'vitest';

import TurnstileWidget from '../../src/lib/TurnstileWidget.svelte';

type TurnstileOptions = {
	callback(token: string): void;
	'expired-callback'(): void;
	'error-callback'(): void;
};

type TurnstileApi = {
	render(container: HTMLElement, options: TurnstileOptions): string;
	remove(widgetId: string): void;
};

const turnstileWindow = window as Window & { turnstile?: TurnstileApi };

afterEach(() => {
	vi.restoreAllMocks();
	delete turnstileWindow.turnstile;
	document.getElementById('cloudflare-turnstile-script')?.remove();
});

test('retries loading after a script failure and forwards widget lifecycle callbacks', async () => {
	const append = vi.spyOn(document.head, 'append').mockImplementation(() => undefined);
	const firstError = vi.fn();
	const first = await render(TurnstileWidget, {
		siteKey: 'site-key',
		action: 'contact',
		label: 'Human verification',
		onverify: vi.fn(),
		onexpire: vi.fn(),
		onerror: firstError
	});
	const failedScript = append.mock.calls[0]?.[0];
	if (!(failedScript instanceof HTMLScriptElement)) {
		throw new Error('Turnstile script was not created.');
	}

	failedScript.dispatchEvent(new Event('error'));
	await vi.waitFor(() => expect(firstError).toHaveBeenCalledOnce());
	expect(document.getElementById('cloudflare-turnstile-script')).toBeNull();
	await first.unmount();

	let options: TurnstileOptions | undefined;
	const renderWidget = vi.fn((_container: HTMLElement, nextOptions: TurnstileOptions) => {
		options = nextOptions;
		return 'widget-1';
	});
	const removeWidget = vi.fn();
	const onverify = vi.fn();
	const onexpire = vi.fn();
	const onerror = vi.fn();
	const retry = await render(TurnstileWidget, {
		siteKey: 'site-key',
		action: 'contact',
		label: 'Human verification',
		onverify,
		onexpire,
		onerror
	});
	const retryScript = append.mock.calls[1]?.[0];
	if (!(retryScript instanceof HTMLScriptElement)) {
		throw new Error('Turnstile retry script was not created.');
	}
	turnstileWindow.turnstile = { render: renderWidget, remove: removeWidget };
	retryScript.dispatchEvent(new Event('load'));

	await vi.waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
	expect(retryScript.src).toBe(
		'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
	);
	expect(retryScript.async).toBe(true);
	expect(retryScript.defer).toBe(true);
	options?.callback('verified-token');
	options?.['expired-callback']();
	options?.['error-callback']();
	expect(onverify).toHaveBeenCalledWith('verified-token');
	expect(onexpire).toHaveBeenCalledOnce();
	expect(onerror).toHaveBeenCalledOnce();

	await retry.unmount();
	expect(removeWidget).toHaveBeenCalledWith('widget-1');
});

test('reports a missing site key without loading the external script', async () => {
	const onerror = vi.fn();
	await render(TurnstileWidget, {
		siteKey: ' ',
		action: 'contact',
		label: 'Human verification',
		onverify: vi.fn(),
		onexpire: vi.fn(),
		onerror
	});

	await vi.waitFor(() => expect(onerror).toHaveBeenCalledOnce());
	expect(document.getElementById('cloudflare-turnstile-script')).toBeNull();
});
