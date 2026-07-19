import { afterEach, expect, test, vi } from 'vitest';

import { submitContactRequest } from '$lib/contact-request.js';

afterEach(() => {
	vi.unstubAllGlobals();
});

test('posts contact payloads to the contact endpoint', async () => {
	const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		void input;
		void init;
		return Promise.resolve(new Response(null, { status: 202 }));
	});
	vi.stubGlobal('fetch', fetchMock);
	const payload = {
		turnstileToken: 'verification',
		name: 'Ada Lovelace',
		email: 'ada@example.com',
		message: 'Please send specifications.'
	};

	await submitContactRequest('https://forms.example.com/base', payload);

	expect(fetchMock).toHaveBeenCalledOnce();
	const [endpoint, init] = fetchMock.mock.calls[0] ?? [];
	expect(String(endpoint)).toBe('https://forms.example.com/base/contact');
	expect(init).toEqual(
		expect.objectContaining({
			method: 'POST',
			body: JSON.stringify(payload)
		})
	);
});

test('rejects unsuccessful contact responses', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(null, { status: 502 }))
	);

	await expect(
		submitContactRequest('https://forms.example.com', {
			turnstileToken: 'verification',
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			message: 'Please send specifications.'
		})
	).rejects.toThrow('status 502');
});
