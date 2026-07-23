import { z } from '@packages/schemas';
import { deliverQueuedMessage, type DeliveryLogEntry, type QueuedDelivery } from './delivery.js';

import { handleRequest, type TurnstileVerification, type WorkerConfig } from './worker.js';

const turnstileResponseSchema = z
	.object({
		success: z.boolean(),
		action: z.string().optional(),
		hostname: z.string().optional(),
		'error-codes': z.array(z.string()).optional()
	})
	.passthrough();

function required(value: string | undefined, name: string): string {
	const normalized = value?.trim();
	if (!normalized) throw new Error(`${name} must be configured.`);
	return normalized;
}

function requiredEmail(value: string | undefined, name: string): string {
	const parsed = z.email().max(254).safeParse(required(value, name));
	if (!parsed.success) throw new Error(`${name} must be a valid email address.`);
	return parsed.data;
}

function parseAllowedOrigin(value: string): string {
	const url = new URL(value);
	const isLoopback =
		url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
	if (
		(url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) ||
		url.username ||
		url.password ||
		url.pathname !== '/' ||
		url.search ||
		url.hash
	) {
		throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins.');
	}
	return url.origin;
}

function readConfig(env: Env): WorkerConfig {
	const origins = required(env.ALLOWED_ORIGINS, 'ALLOWED_ORIGINS')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
		.map(parseAllowedOrigin);

	return {
		senderEmail: requiredEmail(env.CONTACT_SENDER_EMAIL, 'CONTACT_SENDER_EMAIL'),
		recipientEmail: requiredEmail(env.CONTACT_RECIPIENT_EMAIL, 'CONTACT_RECIPIENT_EMAIL'),
		turnstileSecret: required(env.TURNSTILE_SECRET_KEY, 'TURNSTILE_SECRET_KEY'),
		allowedOrigins: new Set(origins)
	};
}

async function verifyTurnstile(input: {
	secret: string;
	token: string;
	remoteIp?: string;
	requestId: string;
}): Promise<TurnstileVerification> {
	const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			secret: input.secret,
			response: input.token,
			remoteip: input.remoteIp,
			idempotency_key: input.requestId
		}),
		signal: AbortSignal.timeout(5000)
	});
	if (!response.ok) throw new Error('Turnstile Siteverify request failed.');

	const parsed = turnstileResponseSchema.safeParse(await response.json());
	if (!parsed.success) throw new Error('Turnstile Siteverify returned an invalid response.');
	return {
		success: parsed.data.success,
		action: parsed.data.action,
		hostname: parsed.data.hostname,
		errorCodes: parsed.data['error-codes']
	};
}

function logDelivery(entry: DeliveryLogEntry): void {
	if (entry.outcome === 'DELIVERED') console.info(entry);
	else console.error(entry);
}

export default {
	async fetch(request, env): Promise<Response> {
		return handleRequest(request, readConfig(env), {
			rateLimit: (key) => env.CONTACT_RATE_LIMITER.limit({ key }),
			verifyTurnstile,
			enqueueDelivery: async (delivery) => {
				await env.CONTACT_QUEUE.send(delivery);
			},
			log: (entry) => {
				const logEntry = { event: 'contact_request', ...entry };
				if (entry.status >= 500) console.error(logEntry);
				else console.info(logEntry);
			},
			createRequestId: () => crypto.randomUUID(),
			now: () => Date.now()
		});
	},
	async queue(batch, env): Promise<void> {
		const config = readConfig(env);
		await Promise.all(
			batch.messages.map((message) =>
				deliverQueuedMessage(message, config, {
					sendEmail: async (outgoingEmail) => {
						await env.EMAIL.send(outgoingEmail);
					},
					log: logDelivery
				})
			)
		);
	}
} satisfies ExportedHandler<Env, QueuedDelivery>;
