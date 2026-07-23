import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAdminApiClient } from './client';

afterEach(() => {
	vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('admin browser API client', () => {
	it('sends credentials and an in-memory CSRF token for mutations', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
			.mockResolvedValueOnce(jsonResponse({ id: 'product-id' }, 201));
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		await client.requestJson('/api/management/products', {
			method: 'POST',
			body: JSON.stringify({ name: 'Product' })
		});

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch.mock.calls[0]?.[0]).toBe('https://api.example.com/api/auth/csrf');
		const mutation = fetch.mock.calls[1];
		expect(mutation?.[0]).toBe('https://api.example.com/api/management/products');
		expect(mutation?.[1]?.credentials).toBe('include');
		expect(new Headers(mutation?.[1]?.headers).get('x-csrf-token')).toBe('csrf-token');
		expect(new Headers(mutation?.[1]?.headers).has('authorization')).toBe(false);
	});

	it('re-fetches the CSRF token and retries a rejected mutation once', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValueOnce(jsonResponse({ csrfToken: 'stale-token' }))
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'CSRF_VALIDATION_FAILED', message: 'Invalid CSRF token' } },
					403
				)
			)
			.mockResolvedValueOnce(jsonResponse({ csrfToken: 'fresh-token' }))
			.mockResolvedValueOnce(jsonResponse({ id: 'product-id' }, 201));
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com/', fetch });

		await client.requestJson('/api/management/products', {
			method: 'POST',
			body: JSON.stringify({ name: 'Product' })
		});

		expect(fetch).toHaveBeenCalledTimes(4);
		expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get('x-csrf-token')).toBe('stale-token');
		expect(new Headers(fetch.mock.calls[3]?.[1]?.headers).get('x-csrf-token')).toBe('fresh-token');
	});

	it('rejects a malformed CSRF bootstrap response', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(jsonResponse({}));
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		await expect(
			client.requestNoContent('/api/auth/logout', { method: 'POST', body: '{}' })
		).rejects.toMatchObject({ status: 500, code: 'INVALID_CSRF_RESPONSE' });
	});

	it.each([
		{
			name: 'missing JSON content type',
			response: () => new Response('{}', { status: 200 })
		},
		{
			name: 'malformed JSON body',
			response: () =>
				new Response('{', { status: 200, headers: { 'content-type': 'application/json' } })
		}
	])('rejects a successful response with $name', async ({ response }) => {
		const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(response());
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		await expect(
			client.requestJson('/api/auth/state', {}, { authenticated: false })
		).rejects.toMatchObject({ status: 502, code: 'INVALID_API_RESPONSE' });
	});

	it('refreshes an expired cookie session once and retries the original request', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValueOnce(
				jsonResponse({ error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Expired' } }, 401)
			)
			.mockResolvedValueOnce(jsonResponse({ status: 'refresh_required' }))
			.mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
			.mockResolvedValueOnce(jsonResponse({ status: 'authenticated' }))
			.mockResolvedValueOnce(jsonResponse({ data: ['ok'] }));
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		const result = await client.requestJson<{ data: string[] }>('/api/management/products');

		expect(result).toEqual({ data: ['ok'] });
		expect(fetch.mock.calls.map((call) => call[0])).toEqual([
			'https://api.example.com/api/management/products',
			'https://api.example.com/api/auth/state',
			'https://api.example.com/api/auth/csrf',
			'https://api.example.com/api/auth/refresh',
			'https://api.example.com/api/management/products'
		]);
	});

	it('waits for an in-flight refresh before sending another protected request', async () => {
		let resolveRefresh: (() => void) | undefined;
		const refreshReleased = new Promise<void>((resolve) => {
			resolveRefresh = resolve;
		});
		let productRequestCount = 0;
		const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
			const requestUrl = String(input);
			if (requestUrl.endsWith('/api/auth/state'))
				return jsonResponse({ status: 'refresh_required' });
			if (requestUrl.endsWith('/api/auth/csrf')) return jsonResponse({ csrfToken: 'csrf-token' });
			if (requestUrl.endsWith('/api/auth/refresh')) {
				await refreshReleased;
				return jsonResponse({ status: 'authenticated' });
			}

			productRequestCount += 1;
			if (productRequestCount === 1) {
				return jsonResponse({ error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Expired' } }, 401);
			}
			return jsonResponse({ data: ['ok'] });
		});
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		const firstRequest = client.requestJson('/api/management/products');
		await vi.waitFor(() => {
			expect(fetch.mock.calls.some(([input]) => String(input).endsWith('/api/auth/refresh'))).toBe(
				true
			);
		});
		const secondRequest = client.requestJson('/api/management/dashboard');
		await Promise.resolve();

		expect(productRequestCount).toBe(1);
		resolveRefresh?.();
		await expect(firstRequest).resolves.toEqual({ data: ['ok'] });
		await expect(secondRequest).resolves.toEqual({ data: ['ok'] });
	});

	it('does not refresh public authentication requests', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValueOnce(
				jsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid' } }, 401)
			);
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		await expect(
			client.requestJson('/api/auth/state', {}, { authenticated: false })
		).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('refreshes a session after any authenticated 401 response', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in required' } },
					401
				)
			)
			.mockResolvedValueOnce(jsonResponse({ status: 'refresh_required' }))
			.mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
			.mockResolvedValueOnce(jsonResponse({ status: 'authenticated' }))
			.mockResolvedValueOnce(jsonResponse({ data: ['ok'] }));
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		await expect(client.requestJson('/api/management/products')).resolves.toEqual({ data: ['ok'] });
		expect(fetch).toHaveBeenCalledTimes(5);
	});

	it('coalesces refresh requests from concurrent authenticated failures', async () => {
		let productRequestCount = 0;
		const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
			const requestUrl = String(input);
			if (requestUrl.endsWith('/api/auth/state'))
				return jsonResponse({ status: 'refresh_required' });
			if (requestUrl.endsWith('/api/auth/csrf')) {
				return jsonResponse({ csrfToken: 'csrf-token' });
			}
			if (requestUrl.endsWith('/api/auth/refresh')) {
				return jsonResponse({ status: 'authenticated' });
			}

			productRequestCount += 1;
			if (productRequestCount <= 2) {
				return jsonResponse({ error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Expired' } }, 401);
			}
			return jsonResponse({ data: ['ok'] });
		});
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		const results = await Promise.all([
			client.requestJson<{ data: string[] }>('/api/management/products'),
			client.requestJson<{ data: string[] }>('/api/management/products')
		]);

		expect(results).toEqual([{ data: ['ok'] }, { data: ['ok'] }]);
		expect(
			fetch.mock.calls.filter(([input]) => String(input).endsWith('/api/auth/refresh'))
		).toHaveLength(1);
	});

	it('recovers a stale CSRF token while refreshing a session', async () => {
		let csrfRequestCount = 0;
		let refreshRequestCount = 0;
		let productRequestCount = 0;
		const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
			const requestUrl = String(input);
			if (requestUrl.endsWith('/api/auth/state'))
				return jsonResponse({ status: 'refresh_required' });
			if (requestUrl.endsWith('/api/auth/csrf')) {
				csrfRequestCount += 1;
				return jsonResponse({
					csrfToken: csrfRequestCount === 1 ? 'stale-token' : 'fresh-token'
				});
			}
			if (requestUrl.endsWith('/api/auth/refresh')) {
				refreshRequestCount += 1;
				return refreshRequestCount === 1
					? jsonResponse(
							{ error: { code: 'CSRF_VALIDATION_FAILED', message: 'Invalid CSRF token' } },
							403
						)
					: jsonResponse({ status: 'authenticated' });
			}

			productRequestCount += 1;
			return productRequestCount === 1
				? jsonResponse({ error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Expired' } }, 401)
				: jsonResponse({ data: ['ok'] });
		});
		const client = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		await expect(
			client.requestJson<{ data: string[] }>('/api/management/products')
		).resolves.toEqual({ data: ['ok'] });
		expect(csrfRequestCount).toBe(2);
		expect(refreshRequestCount).toBe(2);
	});

	it('handles terminal refresh failure once and stops later protected requests', async () => {
		const onSessionExpired = vi.fn();
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValueOnce(
				jsonResponse({ error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Expired' } }, 401)
			)
			.mockResolvedValueOnce(jsonResponse({ status: 'refresh_required' }))
			.mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
			.mockResolvedValueOnce(
				jsonResponse({ error: { code: 'SESSION_IDLE_EXPIRED', message: 'Expired' } }, 401)
			);
		const client = createAdminApiClient({
			baseUrl: 'https://api.example.com',
			fetch,
			onSessionExpired
		});

		await expect(client.requestJson('/api/management/products')).rejects.toMatchObject({
			status: 401
		});
		await expect(client.requestJson('/api/management/dashboard')).rejects.toMatchObject({
			status: 401,
			code: 'SESSION_EXPIRED'
		});

		expect(onSessionExpired).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledTimes(4);
	});

	it('serializes refresh across two clients and retries each request once', async () => {
		let authenticated = false;
		let refreshCount = 0;
		let lockTail = Promise.resolve();
		const requestLock = <T>(_name: string, callback: () => Promise<T>): Promise<T> => {
			const result = lockTail.then(callback);
			lockTail = result.then(
				() => undefined,
				() => undefined
			);
			return result;
		};
		vi.stubGlobal('navigator', { locks: { request: requestLock } });

		const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
			const requestUrl = String(input);
			if (requestUrl.endsWith('/api/auth/state')) {
				return jsonResponse({ status: authenticated ? 'authenticated' : 'refresh_required' });
			}
			if (requestUrl.endsWith('/api/auth/csrf')) return jsonResponse({ csrfToken: 'csrf-token' });
			if (requestUrl.endsWith('/api/auth/refresh')) {
				refreshCount += 1;
				authenticated = true;
				return jsonResponse({ status: 'authenticated' });
			}
			return authenticated
				? jsonResponse({ data: ['ok'] })
				: jsonResponse({ error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Expired' } }, 401);
		});
		const firstClient = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });
		const secondClient = createAdminApiClient({ baseUrl: 'https://api.example.com', fetch });

		await expect(
			Promise.all([
				firstClient.requestJson('/api/management/products'),
				secondClient.requestJson('/api/management/dashboard')
			])
		).resolves.toEqual([{ data: ['ok'] }, { data: ['ok'] }]);
		expect(refreshCount).toBe(1);
	});
});
