import { afterEach, describe, expect, it, vi } from 'vitest';

import contactWorker from '../src/index.js';
import {
	createQueuedDelivery,
	deliverQueuedMessage,
	type DeliveryLogEntry,
	type DeliveryMessage,
	type QueuedDelivery
} from '../src/delivery.js';
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
	deliveries: QueuedDelivery[];
	logs: WorkerLogEntry[];
} {
	const deliveries: QueuedDelivery[] = [];
	const logs: WorkerLogEntry[] = [];
	return {
		deliveries,
		logs,
		dependencies: {
			rateLimit: async () => ({ success: true }),
			verifyTurnstile: async ({ token }) => ({
				success: true,
				action: token,
				hostname: 'www.example.com'
			}),
			enqueueDelivery: async (delivery) => {
				deliveries.push(delivery);
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
		CONTACT_QUEUE: { send: vi.fn(async () => undefined) },
		CONTACT_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
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

function queueEntrypoint(
	messages: DeliveryMessage[],
	env: Parameters<typeof contactWorker.fetch>[1]
): Promise<void> {
	return contactWorker.queue(
		{ messages } as unknown as Parameters<typeof contactWorker.queue>[0],
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
		expect(harness.deliveries).toHaveLength(0);
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
		const prefixMediaResponse = await handleRequest(
			request('/contact', validContact, { contentType: 'application/json-malicious' }),
			config,
			harness.dependencies
		);

		expect(routeResponse.status).toBe(404);
		expect(methodResponse.status).toBe(405);
		expect(mediaResponse.status).toBe(415);
		expect(prefixMediaResponse.status).toBe(415);
		expect(harness.deliveries).toHaveLength(0);
	});

	it('rate limits requests before parsing or Turnstile verification', async () => {
		const verifyTurnstile = vi.fn(async () => ({ success: true }));
		const rateLimit = vi.fn(async () => ({ success: false }));
		const harness = dependencies({ rateLimit, verifyTurnstile });
		const response = await handleRequest(
			request('/contact', validContact, {
				headers: { 'CF-Connecting-IP': '203.0.113.8' }
			}),
			config,
			harness.dependencies
		);

		expect(response.status).toBe(429);
		expect(response.headers.get('Retry-After')).toBe('60');
		expect((await errorPayload(response)).error.code).toBe('RATE_LIMITED');
		expect(rateLimit).toHaveBeenCalledWith('contact:203.0.113.8');
		expect(verifyTurnstile).not.toHaveBeenCalled();
		expect(harness.deliveries).toHaveLength(0);
	});

	it('fails closed when the rate limiter is unavailable', async () => {
		const harness = dependencies({
			rateLimit: async () => {
				throw new Error('binding unavailable');
			}
		});
		const response = await handleRequest(request('/contact'), config, harness.dependencies);

		expect(response.status).toBe(503);
		expect((await errorPayload(response)).error.code).toBe('RATE_LIMIT_UNAVAILABLE');
		expect(harness.deliveries).toHaveLength(0);
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
		expect(harness.deliveries).toHaveLength(0);
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
		expect(harness.deliveries).toHaveLength(0);
	});

	it('enqueues a contact request without retaining its verification token', async () => {
		const harness = dependencies();
		const response = await handleRequest(
			request('/contact', { ...validContact, message: '<script>alert(1)</script>' }),
			config,
			harness.dependencies
		);

		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({ ok: true });
		expect(response.headers.get('X-Request-Id')).toBe('request-123');
		expect(harness.deliveries).toHaveLength(1);
		const delivery = harness.deliveries[0];
		expect(delivery).toMatchObject({
			version: 1,
			kind: 'contact',
			requestId: 'request-123',
			submittedAt: new Date(100).toISOString(),
			request: {
				email: 'ada@example.com',
				message: '<script>alert(1)</script>'
			}
		});
		expect(delivery?.request).not.toHaveProperty('turnstileToken');
	});

	it('enqueues inquiry fields for asynchronous delivery', async () => {
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
		expect(harness.deliveries).toHaveLength(1);
		expect(harness.deliveries[0]).toMatchObject({
			kind: 'inquiry',
			request: { skuCode: 'SKU-1\r\nBcc: attacker@example.com' }
		});
	});

	it('returns a generic queue failure and writes metadata-only duration logs', async () => {
		const times = [100, 145];
		const harness = dependencies({
			enqueueDelivery: async () => {
				throw new Error('queue included ada@example.com');
			},
			now: () => times.shift() ?? 145
		});
		const response = await handleRequest(request('/contact'), config, harness.dependencies);
		const payload = await errorPayload(response);

		expect(response.status).toBe(503);
		expect(payload.error.code).toBe('DELIVERY_UNAVAILABLE');
		expect(harness.logs).toEqual([
			{
				requestId: 'request-123',
				route: '/contact',
				method: 'POST',
				status: 503,
				outcome: 'DELIVERY_UNAVAILABLE',
				durationMs: 45
			}
		]);
		expect(JSON.stringify(harness.logs)).not.toMatch(/ada@example\.com|specifications/);
	});

	it('returns a generic internal error with CORS for unexpected failures', async () => {
		const times = [100, Number.NaN, 145];
		const harness = dependencies({
			now: () => times.shift() ?? 145
		});
		const response = await handleRequest(request('/contact'), config, harness.dependencies);
		const payload = await errorPayload(response);

		expect(response.status).toBe(500);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);
		expect(payload.error.code).toBe('INTERNAL_ERROR');
		expect(JSON.stringify(payload)).not.toMatch(/invalid time|rangeerror/i);
		expect(harness.logs).toEqual([
			expect.objectContaining({
				status: 500,
				outcome: 'INTERNAL_ERROR',
				durationMs: 45
			})
		]);
	});

	it('omits CORS headers from unexpected failures after the origin is removed', async () => {
		const incoming = request('/contact');
		const times = [100, Number.NaN, 145];
		const allowedOrigins = {
			has: (origin: string) => {
				incoming.headers.delete('Origin');
				return origin === allowedOrigin;
			}
		} as unknown as ReadonlySet<string>;
		const harness = dependencies({
			now: () => times.shift() ?? 145
		});
		const response = await handleRequest(
			incoming,
			{ ...config, allowedOrigins },
			harness.dependencies
		);

		expect(response.status).toBe(500);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
		expect((await errorPayload(response)).error.code).toBe('INTERNAL_ERROR');
	});
});

const queuedRequestId = '00000000-0000-4000-8000-000000000001';

function deliveryMessage(body: unknown): {
	message: DeliveryMessage;
	ack: ReturnType<typeof vi.fn>;
	retry: ReturnType<typeof vi.fn>;
} {
	const ack = vi.fn();
	const retry = vi.fn();
	return {
		message: { id: 'message-123', body, attempts: 1, ack, retry },
		ack,
		retry
	};
}

describe('contact delivery consumer', () => {
	it('sends and acknowledges a schema-valid contact message', async () => {
		const queued = createQueuedDelivery(
			'contact',
			{ ...validContact, message: '<script>alert(1)</script>' },
			queuedRequestId,
			new Date('2026-07-21T00:00:00.000Z')
		);
		const harness = deliveryMessage(queued);
		const sent: OutgoingEmail[] = [];
		const logs: DeliveryLogEntry[] = [];

		await deliverQueuedMessage(harness.message, config, {
			sendEmail: async (email) => {
				sent.push(email);
			},
			log: (entry) => logs.push(entry)
		});

		expect(harness.ack).toHaveBeenCalledOnce();
		expect(harness.retry).not.toHaveBeenCalled();
		expect(sent).toHaveLength(1);
		expect(sent[0]?.replyTo).toBe('ada@example.com');
		expect(sent[0]?.html).not.toMatch(/<script>/);
		expect(sent[0]?.html).toMatch(/&lt;script&gt;/);
		expect(logs).toEqual([
			{
				event: 'contact_delivery',
				requestId: queuedRequestId,
				messageId: 'message-123',
				attempts: 1,
				outcome: 'DELIVERED'
			}
		]);
	});

	it('sanitizes inquiry data when constructing the delivered email', async () => {
		const queued = createQueuedDelivery(
			'inquiry',
			{
				turnstileToken: 'inquiry',
				name: 'Grace Hopper',
				email: 'grace@example.com',
				skuCode: 'SKU-1\r\nBcc: attacker@example.com',
				message: 'Please quote 100 units.'
			},
			queuedRequestId,
			new Date('2026-07-21T00:00:00.000Z')
		);
		const harness = deliveryMessage(queued);
		const sent: OutgoingEmail[] = [];

		await deliverQueuedMessage(harness.message, config, {
			sendEmail: async (email) => {
				sent.push(email);
			},
			log: () => undefined
		});

		expect(sent[0]?.subject).not.toMatch(/[\r\n]/);
		expect(sent[0]?.subject).toMatch(/inquiry - SKU-1 Bcc: attacker@example\.com/);
		expect(sent[0]?.text).toMatch(/Product SKU:\nSKU-1/);
	});

	it('retries provider failures without logging request content', async () => {
		const queued = createQueuedDelivery(
			'contact',
			validContact,
			queuedRequestId,
			new Date('2026-07-21T00:00:00.000Z')
		);
		const harness = deliveryMessage(queued);
		const logs: DeliveryLogEntry[] = [];

		await deliverQueuedMessage(harness.message, config, {
			sendEmail: async () => {
				throw new Error('provider included ada@example.com');
			},
			log: (entry) => logs.push(entry)
		});

		expect(harness.ack).not.toHaveBeenCalled();
		expect(harness.retry).toHaveBeenCalledOnce();
		expect(logs[0]?.outcome).toBe('DELIVERY_FAILED');
		expect(JSON.stringify(logs)).not.toMatch(/ada@example\.com|specifications/);
	});

	it('retries malformed queue payloads without parsing request data', async () => {
		const harness = deliveryMessage({ requestId: 'not-a-uuid', email: 'ada@example.com' });
		const sendEmail = vi.fn(async () => undefined);
		const logs: DeliveryLogEntry[] = [];

		await deliverQueuedMessage(harness.message, config, {
			sendEmail,
			log: (entry) => logs.push(entry)
		});

		expect(sendEmail).not.toHaveBeenCalled();
		expect(harness.ack).not.toHaveBeenCalled();
		expect(harness.retry).toHaveBeenCalledOnce();
		expect(logs[0]).toMatchObject({ requestId: 'unknown', outcome: 'INVALID_MESSAGE' });
		expect(JSON.stringify(logs)).not.toMatch(/ada@example\.com/);
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
		const queueSend = vi
			.fn<(delivery: QueuedDelivery) => Promise<void>>()
			.mockResolvedValue(undefined);
		const env = runtimeEnv({ EMAIL: { send: emailSend }, CONTACT_QUEUE: { send: queueSend } });
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
		expect(queueSend).toHaveBeenCalledOnce();
		expect(emailSend).not.toHaveBeenCalled();
		const queued = queueSend.mock.calls[0]?.[0];
		expect(queued?.request).not.toHaveProperty('turnstileToken');
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
		const queueSend = vi.fn(async () => undefined);
		const response = await fetchEntrypoint(
			request('/contact'),
			runtimeEnv({ CONTACT_QUEUE: { send: queueSend } })
		);

		expect(response.status).toBe(502);
		expect((await errorPayload(response)).error.code).toBe('VERIFICATION_UNAVAILABLE');
		expect(queueSend).not.toHaveBeenCalled();
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

	it('delivers queued messages through the runtime bindings and logs success', async () => {
		const queued = createQueuedDelivery(
			'contact',
			validContact,
			queuedRequestId,
			new Date('2026-07-21T00:00:00.000Z')
		);
		const harness = deliveryMessage(queued);
		const emailSend = vi.fn(async () => undefined);
		const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

		await queueEntrypoint([harness.message], runtimeEnv({ EMAIL: { send: emailSend } }));

		expect(emailSend).toHaveBeenCalledOnce();
		expect(harness.ack).toHaveBeenCalledOnce();
		expect(harness.retry).not.toHaveBeenCalled();
		expect(info).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'contact_delivery',
				outcome: 'DELIVERED'
			})
		);
	});

	it('retries queue delivery failures and logs only metadata', async () => {
		const queued = createQueuedDelivery(
			'contact',
			validContact,
			queuedRequestId,
			new Date('2026-07-21T00:00:00.000Z')
		);
		const harness = deliveryMessage(queued);
		const emailSend = vi.fn(async () => {
			throw new Error('provider included ada@example.com');
		});
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		await queueEntrypoint([harness.message], runtimeEnv({ EMAIL: { send: emailSend } }));

		expect(harness.ack).not.toHaveBeenCalled();
		expect(harness.retry).toHaveBeenCalledOnce();
		expect(error).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'contact_delivery',
				outcome: 'DELIVERY_FAILED'
			})
		);
		expect(JSON.stringify(error.mock.calls)).not.toMatch(/ada@example\.com|specifications/);
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

	it('fails fast when an allowed origin is insecure or contains URL credentials', async () => {
		await expect(
			fetchEntrypoint(request('/contact'), runtimeEnv({ ALLOWED_ORIGINS: 'http://example.com' }))
		).rejects.toThrow('ALLOWED_ORIGINS');
		await expect(
			fetchEntrypoint(
				request('/contact'),
				runtimeEnv({ ALLOWED_ORIGINS: 'https://user:password@example.com' })
			)
		).rejects.toThrow('ALLOWED_ORIGINS');
	});

	it('fails fast when a configured email address is invalid', async () => {
		await expect(
			fetchEntrypoint(request('/contact'), runtimeEnv({ CONTACT_SENDER_EMAIL: 'not-an-email' }))
		).rejects.toThrow('CONTACT_SENDER_EMAIL must be a valid email address.');
	});
});
