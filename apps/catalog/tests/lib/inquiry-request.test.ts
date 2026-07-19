import { afterEach, expect, test, vi } from 'vitest';

import { submitInquiryRequest } from '$lib/inquiry-request.js';

afterEach(() => {
	vi.unstubAllGlobals();
});

test('posts inquiry payloads to the inquiry endpoint', async () => {
	const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		void input;
		void init;
		return Promise.resolve(new Response(null, { status: 202 }));
	});
	vi.stubGlobal('fetch', fetchMock);
	const payload = {
		turnstileToken: 'verification',
		name: 'Grace Hopper',
		email: 'grace@example.com',
		skuCode: 'SKU-100',
		message: 'Please quote 100 units.'
	};

	await submitInquiryRequest('https://forms.example.com/base', payload);

	expect(fetchMock).toHaveBeenCalledOnce();
	const [endpoint, init] = fetchMock.mock.calls[0] ?? [];
	expect(String(endpoint)).toBe('https://forms.example.com/base/inquiry');
	expect(init).toEqual(
		expect.objectContaining({
			method: 'POST',
			body: JSON.stringify(payload)
		})
	);
});

test('rejects unsuccessful inquiry responses', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(null, { status: 502 }))
	);

	await expect(
		submitInquiryRequest('https://forms.example.com', {
			turnstileToken: 'verification',
			name: 'Grace Hopper',
			email: 'grace@example.com',
			message: 'Please quote 100 units.'
		})
	).rejects.toThrow('status 502');
});
