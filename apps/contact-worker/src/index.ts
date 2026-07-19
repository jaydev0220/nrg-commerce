import { z } from 'zod';

import { handleRequest, type TurnstileVerification, type WorkerConfig } from './worker.js';

type ContactWorkerEnv = Env & {
	CONTACT_SENDER_EMAIL: string;
	CONTACT_RECIPIENT_EMAIL: string;
	TURNSTILE_SECRET_KEY: string;
	ALLOWED_ORIGINS: string;
};

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

function readConfig(env: ContactWorkerEnv): WorkerConfig {
	const origins = required(env.ALLOWED_ORIGINS, 'ALLOWED_ORIGINS')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
		.map((origin) => new URL(origin).origin);

	return {
		senderEmail: required(env.CONTACT_SENDER_EMAIL, 'CONTACT_SENDER_EMAIL'),
		recipientEmail: required(env.CONTACT_RECIPIENT_EMAIL, 'CONTACT_RECIPIENT_EMAIL'),
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

export default {
	async fetch(request, env): Promise<Response> {
		return handleRequest(request, readConfig(env), {
			verifyTurnstile,
			sendEmail: async (message) => {
				await env.EMAIL.send(message);
			},
			log: (entry) => {
				const logEntry = { event: 'contact_request', ...entry };
				if (entry.status >= 500) console.error(logEntry);
				else console.info(logEntry);
			},
			createRequestId: () => crypto.randomUUID(),
			now: () => Date.now()
		});
	}
} satisfies ExportedHandler<ContactWorkerEnv>;
