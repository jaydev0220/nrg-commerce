import { afterEach, describe, expect, it, vi } from 'vitest';

import contactWorker from '../src/index.js';
import type { OutgoingEmail } from '../src/email.js';
import type { WorkerDependencies, WorkerLogEntry } from '../src/worker.js';
import { handleRequest } from '../src/worker.js';

const allowedOrigin = 'https://www.example.com';
const config = {
	senderEmail: 'contact@example.com',
	recipientEmail: 'sales@example.com',
	turnstileSecret: 'secret',
	allowedOrigins: new Set([allowedOrigin])
};

const validContact = {
	turnstileToken: 'contact',
	name: 'Ada Lovelace',
	email: 'ada@example.com',
	company: 'Analytical Engines',
	phone: '+886-2-1234-5678',
	inquiryType: 'Enterprise',
	productInterest: 'Hydrometers',
	message: 'Please send specifications.'
};

function request(
	path: string,
	body: unknown = validContact,
	init: {
		method?: string;
		origin?: string | null;
		contentType?: string;
		headers?: Record<string, string>;
	} = {}
): Request {
	const method = init.method ?? 'POST';
	const origin = init.origin === undefined ? allowedOrigin : init.origin;
	return new Request(`https://contact.example.com${path}`, {
		method,
		headers: {
			...(origin ? { Origin: origin } : {}),
			...(method === 'POST' ? { 'Content-Type': init.contentType ?? 'application/json' } : {}),
			...init.headers
		},
		...(method === 'POST' ? { body: JSON.stringify(body) } : {})
	});
}

function emptyRequest(path: string): Request {
	return new Request(`https://contact.example.com${path}`, {
		method: 'POST',
		headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' }
	});
}

function dependencies(overrides: Partial<WorkerDependencies> = {}): {
	dependencies: WorkerDependencies;
	messages: OutgoingEmail[];
	logs: WorkerLogEntry[];
} {
	const messages: OutgoingEmail[] = [];
	const logs: WorkerLogEntry[] = [];
	return {
		messages,
		logs,
		dependencies: {
			verifyTurnstile: async ({ token }) => ({
				success: true,
				action: token,
				hostname: 'www.example.com'
			}),
			sendEmail: async (message) => {
				messages.push(message);
			},
			log: (entry) => logs.push(entry),
			createRequestId: () => 'request-123',
			now: () => 100,
			...overrides
		}
	};
}

type ErrorPayload = {
	error: { code: string; details?: Array<{ path: string; message: string }> };
	requestId: string;
};

async function errorPayload(response: Response): Promise<ErrorPayload> {
	return (await response.json()) as ErrorPayload;
}

function runtimeEnv(
	overrides: Record<string, unknown> = {}
): Parameters<typeof contactWorker.fetch>[1] {
	return {
		EMAIL: { send: vi.fn(async () => undefined) },
		CONTACT_SENDER_EMAIL: 'contact@example.com',
		CONTACT_RECIPIENT_EMAIL: 'sales@example.com',
		TURNSTILE_SECRET_KEY: 'turnstile-secret',
		ALLOWED_ORIGINS: ` ${allowedOrigin}/, https://shop.example.com `,
		...overrides
	} as unknown as Parameters<typeof contactWorker.fetch>[1];
}

function fetchEntrypoint(
	incomingRequest: Request,
	env: Parameters<typeof contactWorker.fetch>[1]
): Promise<Response> {
	return contactWorker.fetch(
		incomingRequest as unknown as Parameters<typeof contactWorker.fetch>[0],
		env
	);
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('contact Worker request handler', () => {
	it('answers allowed preflight requests with exact CORS headers', async () => {
		const harness = dependencies();
		const response = await handleRequest(
			request('/contact', undefined, { method: 'OPTIONS' }),
			config,
			harness.dependencies
		);

		expect(response.status).toBe(204);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);
		expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
		expect(response.headers.get('Vary')).toBe('Origin');
		expect(harness.messages).toHaveLength(0);
	});

	it.each([
		['a missing origin', null],
		['an origin outside the allowlist', 'https://attacker.example']
	])('rejects requests with %s', async (_label, origin) => {
		const harness = dependencies();
		const response = await handleRequest(
			request('/contact', validContact, { origin }),
			config,
			harness.dependencies
		);

		expect(response.status).toBe(403);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
		expect((await errorPayload(response)).error.code).toBe('ORIGIN_NOT_ALLOWED');
	});

	it('rejects unknown routes, unsupported methods, and unsupported media types', async () => {
		const harness = dependencies();
		const routeResponse = await handleRequest(request('/unknown'), config, harness.dependencies);
		const methodResponse = await handleRequest(
			request('/contact', undefined, { method: 'GET' }),
			config,
			harness.dependencies
		);
		const mediaResponse = await handleRequest(
			request('/contact', validContact, { contentType: 'text/plain' }),
			config,
			harness.dependencies
		);

		expect(routeResponse.status).toBe(404);
		expect(methodResponse.status).toBe(405);
		expect(mediaResponse.status).toBe(415);
		expect(harness.messages).toHaveLength(0);
	});

	it('rejects an empty or malformed JSON body', async () => {
		const emptyHarness = dependencies();
		const malformedHarness = dependencies();
		const malformed = new Request('https://contact.example.com/contact', {
			method: 'POST',
			headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
			body: '{invalid'
		});

		const emptyResponse = await handleRequest(
			emptyRequest('/contact'),
			config,
			emptyHarness.dependencies
		);
		const malformedResponse = await handleRequest(malformed, config, malformedHarness.dependencies);

		expect(emptyResponse.status).toBe(400);
		expect((await errorPayload(emptyResponse)).error.code).toBe('INVALID_JSON');
		expect(malformedResponse.status).toBe(400);
		expect((await errorPayload(malformedResponse)).error.code).toBe('INVALID_JSON');
	});

	it('rejects declared and streamed bodies over the byte limit', async () => {
		const declaredHarness = dependencies();
		const streamedHarness = dependencies();
		const declared = request('/contact', validContact, {
			headers: { 'Content-Length': String(16 * 1024 + 1) }
		});
		const streamed = request('/contact', {
			...validContact,
			message: 'x'.repeat(17_000)
		});

		const declaredResponse = await handleRequest(declared, config, declaredHarness.dependencies);
		const streamedResponse = await handleRequest(streamed, config, streamedHarness.dependencies);

		expect(declaredResponse.status).toBe(413);
		expect((await errorPayload(declaredResponse)).error.code).toBe('PAYLOAD_TOO_LARGE');
		expect(streamedResponse.status).toBe(413);
		expect((await errorPayload(streamedResponse)).error.code).toBe('PAYLOAD_TOO_LARGE');
	});

	it('returns field-level details for schema-invalid JSON', async () => {
		const harness = dependencies();
		const response = await handleRequest(
			request('/contact', { ...validContact, email: 'invalid' }),
			config,
			harness.dependencies
		);
		const payload = await errorPayload(response);

		expect(response.status).toBe(400);
		expect(payload.error.code).toBe('VALIDATION_FAILED');
		expect(payload.error.details).toContainEqual({
			path: 'email',
			message: expect.any(String)
		});
	});

	it.each([
		['an unsuccessful result', { success: false }],
		['the wrong action', { success: true, action: 'inquiry', hostname: 'www.example.com' }],
		['the wrong hostname', { success: true, action: 'contact', hostname: 'attacker.example' }]
	])('rejects Turnstile verification with %s', async (_label, verification) => {
		const harness = dependencies({
			verifyTurnstile: async () => verification
		});
		const response = await handleRequest(request('/contact'), config, harness.dependencies);

		expect(response.status).toBe(403);
		expect((await errorPayload(response)).error.code).toBe('VERIFICATION_FAILED');
		expect(harness.messages).toHaveLength(0);
	});

	it('returns a generic gateway error when Turnstile is unavailable', async () => {
		const harness = dependencies({
			verifyTurnstile: async () => {
				throw new Error('network details');
			}
		});
		const response = await handleRequest(request('/contact'), config, harness.dependencies);
		const payload = await errorPayload(response);

		expect(response.status).toBe(502);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);
		expect(payload.error.code).toBe('VERIFICATION_UNAVAILABLE');
		expect(harness.messages).toHaveLength(0);
	});

	it('sends a safe contact email and returns 202', async () => {
		const harness = dependencies();
		const response = await handleRequest(
			request('/contact', { ...validContact, message: '<script>alert(1)</script>' }),
			config,
			harness.dependencies
		);

		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({ ok: true });
		expect(response.headers.get('X-Request-Id')).toBe('request-123');
		expect(harness.messages).toHaveLength(1);
		expect(harness.messages[0]?.replyTo).toBe('ada@example.com');
		const sender = harness.messages[0]?.from;
		expect(typeof sender === 'string' ? sender : sender?.email).toBe('contact@example.com');
		expect(harness.messages[0]?.text).toMatch(/<script>alert\(1\)<\/script>/);
		expect(harness.messages[0]?.html).not.toMatch(/<script>/);
		expect(harness.messages[0]?.html).toMatch(/&lt;script&gt;/);
	});

	it('sends inquiry fields and strips line breaks from the subject', async () => {
		const harness = dependencies();
		const response = await handleRequest(
			request('/inquiry', {
				turnstileToken: 'inquiry',
				name: 'Grace Hopper',
				email: 'grace@example.com',
				skuCode: 'SKU-1\r\nBcc: attacker@example.com',
				message: 'Please quote 100 units.'
			}),
			config,
			harness.dependencies
		);

		expect(response.status).toBe(202);
		expect(harness.messages).toHaveLength(1);
		expect(harness.messages[0]?.subject).not.toMatch(/[\r\n]/);
		expect(harness.messages[0]?.subject).toMatch(/inquiry - SKU-1/);
		expect(harness.messages[0]?.text).toMatch(/Product SKU:\nSKU-1/);
	});

	it('returns a generic delivery failure and writes metadata-only duration logs', async () => {
		const times = [100, 145];
		const harness = dependencies({
			sendEmail: async () => {
				throw new Error('provider included ada@example.com');
			},
			now: () => times.shift() ?? 145
		});
		const response = await handleRequest(request('/contact'), config, harness.dependencies);
		const payload = await errorPayload(response);

		expect(response.status).toBe(502);
		expect(payload.error.code).toBe('DELIVERY_FAILED');
		expect(harness.logs).toEqual([
			{
				requestId: 'request-123',
				route: '/contact',
				method: 'POST',
				status: 502,
				outcome: 'DELIVERY_FAILED',
				durationMs: 45
			}
		]);
		expect(JSON.stringify(harness.logs)).not.toMatch(/ada@example\.com|specifications/);
	});
});

describe('contact Worker entrypoint', () => {
	it('parses configuration, sends the expected Turnstile request, and logs success', async () => {
		const siteverify = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					success: true,
					action: 'contact',
					hostname: 'www.example.com',
					'error-codes': []
				}),
				{ headers: { 'Content-Type': 'application/json' } }
			)
		);
		vi.stubGlobal('fetch', siteverify);
		const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
		const emailSend = vi.fn(async () => undefined);
		const env = runtimeEnv({ EMAIL: { send: emailSend } });
		const incoming = request('/contact', validContact, {
			headers: { 'CF-Connecting-IP': '203.0.113.10' }
		});

		const response = await fetchEntrypoint(incoming, env);

		expect(response.status).toBe(202);
		expect(siteverify).toHaveBeenCalledOnce();
		const [url, init] = siteverify.mock.calls[0] ?? [];
		expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
		expect(init?.method).toBe('POST');
		expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
		const verificationBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
		expect(verificationBody).toMatchObject({
			secret: 'turnstile-secret',
			response: 'contact',
			remoteip: '203.0.113.10',
			idempotency_key: response.headers.get('X-Request-Id')
		});
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		expect(emailSend).toHaveBeenCalledOnce();
		expect(info).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'contact_request',
				status: 202,
				outcome: 'SUCCESS',
				durationMs: expect.any(Number)
			})
		);
	});

	it.each([
		['a non-success status', new Response('gateway failure', { status: 503 })],
		[
			'a malformed response',
			new Response(JSON.stringify({ success: 'yes' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		]
	])('maps Turnstile %s to a metadata-only gateway error', async (_label, turnstileResponse) => {
		vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(turnstileResponse));
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const emailSend = vi.fn(async () => undefined);
		const response = await fetchEntrypoint(
			request('/contact'),
			runtimeEnv({ EMAIL: { send: emailSend } })
		);

		expect(response.status).toBe(502);
		expect((await errorPayload(response)).error.code).toBe('VERIFICATION_UNAVAILABLE');
		expect(emailSend).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'contact_request',
				status: 502,
				outcome: 'VERIFICATION_UNAVAILABLE'
			})
		);
		expect(JSON.stringify(error.mock.calls)).not.toMatch(/ada@example\.com|specifications/);
	});

	it('uses a five-second Turnstile timeout signal', async () => {
		const timeout = vi.spyOn(AbortSignal, 'timeout');
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>().mockRejectedValue(new DOMException('Timed out', 'TimeoutError'))
		);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		const response = await fetchEntrypoint(request('/contact'), runtimeEnv());

		expect(response.status).toBe(502);
		expect(timeout).toHaveBeenCalledWith(5000);
	});

	it.each([
		['CONTACT_SENDER_EMAIL', { CONTACT_SENDER_EMAIL: ' ' }],
		['CONTACT_RECIPIENT_EMAIL', { CONTACT_RECIPIENT_EMAIL: undefined }],
		['TURNSTILE_SECRET_KEY', { TURNSTILE_SECRET_KEY: '' }],
		['ALLOWED_ORIGINS', { ALLOWED_ORIGINS: ' ' }]
	])('fails fast when %s is missing', async (name, override) => {
		await expect(fetchEntrypoint(request('/contact'), runtimeEnv(override))).rejects.toThrow(
			`${name} must be configured.`
		);
	});

	it('fails fast when an allowed origin is not a valid URL', async () => {
		await expect(
			fetchEntrypoint(request('/contact'), runtimeEnv({ ALLOWED_ORIGINS: 'not a url' }))
		).rejects.toThrow();
	});
});
