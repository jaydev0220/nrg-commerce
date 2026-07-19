import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

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
	init: { method?: string; origin?: string; contentType?: string } = {}
): Request {
	const method = init.method ?? 'POST';
	return new Request(`https://contact.example.com${path}`, {
		method,
		headers: {
			Origin: init.origin ?? allowedOrigin,
			...(method === 'POST' ? { 'Content-Type': init.contentType ?? 'application/json' } : {})
		},
		...(method === 'POST' ? { body: JSON.stringify(body) } : {})
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
};

function assertErrorPayload(value: unknown): asserts value is ErrorPayload {
	assert.ok(value && typeof value === 'object' && 'error' in value);
}

describe('contact Worker', () => {
	test('answers allowed preflight requests with exact CORS headers', async () => {
		const harness = dependencies();
		const response = await handleRequest(
			request('/contact', undefined, { method: 'OPTIONS' }),
			config,
			harness.dependencies
		);

		assert.equal(response.status, 204);
		assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
		assert.equal(response.headers.get('Vary'), 'Origin');
		assert.equal(harness.messages.length, 0);
	});

	test('rejects requests from origins outside the allowlist', async () => {
		const harness = dependencies();
		const response = await handleRequest(
			request('/contact', validContact, { origin: 'https://attacker.example' }),
			config,
			harness.dependencies
		);

		assert.equal(response.status, 403);
		assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
		const payload = await response.json();
		assertErrorPayload(payload);
		assert.equal(payload.error.code, 'ORIGIN_NOT_ALLOWED');
	});

	test('rejects unsupported methods and media types', async () => {
		const harness = dependencies();
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

		assert.equal(methodResponse.status, 405);
		assert.equal(mediaResponse.status, 415);
		assert.equal(harness.messages.length, 0);
	});

	test('rejects malformed, oversized, and schema-invalid JSON', async () => {
		const malformedHarness = dependencies();
		const malformed = new Request('https://contact.example.com/contact', {
			method: 'POST',
			headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
			body: '{invalid'
		});
		const malformedResponse = await handleRequest(malformed, config, malformedHarness.dependencies);

		const oversizedHarness = dependencies();
		const oversizedResponse = await handleRequest(
			request('/contact', { ...validContact, message: 'x'.repeat(17_000) }),
			config,
			oversizedHarness.dependencies
		);

		const invalidHarness = dependencies();
		const invalidResponse = await handleRequest(
			request('/contact', { ...validContact, email: 'invalid' }),
			config,
			invalidHarness.dependencies
		);
		const invalidPayload = await invalidResponse.json();
		assertErrorPayload(invalidPayload);

		assert.equal(malformedResponse.status, 400);
		assert.equal(oversizedResponse.status, 413);
		assert.equal(invalidResponse.status, 400);
		assert.equal(invalidPayload.error.code, 'VALIDATION_FAILED');
		assert.equal(invalidPayload.error.details?.[0]?.path, 'email');
	});

	test('requires a successful Turnstile result with the expected action', async () => {
		const failedHarness = dependencies({
			verifyTurnstile: async () => ({ success: false })
		});
		const wrongActionHarness = dependencies({
			verifyTurnstile: async () => ({ success: true, action: 'inquiry' })
		});

		const failedResponse = await handleRequest(
			request('/contact'),
			config,
			failedHarness.dependencies
		);
		const wrongActionResponse = await handleRequest(
			request('/contact'),
			config,
			wrongActionHarness.dependencies
		);

		assert.equal(failedResponse.status, 403);
		assert.equal(wrongActionResponse.status, 403);
		assert.equal(failedHarness.messages.length + wrongActionHarness.messages.length, 0);
	});

	test('returns a generic gateway error when Turnstile is unavailable', async () => {
		const harness = dependencies({
			verifyTurnstile: async () => {
				throw new Error('network details');
			}
		});
		const response = await handleRequest(request('/contact'), config, harness.dependencies);
		const payload = await response.json();
		assertErrorPayload(payload);

		assert.equal(response.status, 502);
		assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
		assert.equal(payload.error.code, 'VERIFICATION_UNAVAILABLE');
		assert.equal(harness.messages.length, 0);
	});

	test('sends a safe contact email and returns 202', async () => {
		const harness = dependencies();
		const response = await handleRequest(
			request('/contact', { ...validContact, message: '<script>alert(1)</script>' }),
			config,
			harness.dependencies
		);

		assert.equal(response.status, 202);
		assert.deepEqual(await response.json(), { ok: true });
		assert.equal(response.headers.get('X-Request-Id'), 'request-123');
		assert.equal(harness.messages.length, 1);
		assert.equal(harness.messages[0]?.replyTo, 'ada@example.com');
		const sender = harness.messages[0]?.from;
		assert.equal(typeof sender === 'string' ? sender : sender?.email, 'contact@example.com');
		assert.match(harness.messages[0]?.text ?? '', /<script>alert\(1\)<\/script>/);
		assert.doesNotMatch(harness.messages[0]?.html ?? '', /<script>/);
		assert.match(harness.messages[0]?.html ?? '', /&lt;script&gt;/);
	});

	test('sends inquiry fields and strips line breaks from the subject', async () => {
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

		assert.equal(response.status, 202);
		assert.equal(harness.messages.length, 1);
		assert.doesNotMatch(harness.messages[0]?.subject ?? '', /[\r\n]/);
		assert.match(harness.messages[0]?.subject ?? '', /inquiry - SKU-1/);
		assert.match(harness.messages[0]?.text ?? '', /Product SKU:\nSKU-1/);
	});

	test('returns a generic delivery failure and writes metadata-only logs', async () => {
		const harness = dependencies({
			sendEmail: async () => {
				throw new Error('provider included ada@example.com');
			}
		});
		const response = await handleRequest(request('/contact'), config, harness.dependencies);
		const payload = await response.json();
		assertErrorPayload(payload);

		assert.equal(response.status, 502);
		assert.equal(payload.error.code, 'DELIVERY_FAILED');
		assert.equal(harness.logs.length, 1);
		assert.deepEqual(harness.logs[0], {
			requestId: 'request-123',
			route: '/contact',
			method: 'POST',
			status: 502,
			outcome: 'DELIVERY_FAILED',
			durationMs: 0
		});
		assert.doesNotMatch(JSON.stringify(harness.logs), /ada@example\.com|specifications/);
	});
});
