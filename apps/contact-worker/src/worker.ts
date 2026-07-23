import {
	contactRequestSchema,
	inquiryRequestSchema,
	type ContactRequest,
	type InquiryRequest,
	type ZodType
} from '@packages/schemas';

import { createQueuedDelivery, type QueuedDelivery } from './delivery.js';

const MAX_BODY_BYTES = 16 * 1024;

type RequestKind = 'contact' | 'inquiry';
type FormRequest = ContactRequest | InquiryRequest;

export type WorkerConfig = {
	senderEmail: string;
	recipientEmail: string;
	turnstileSecret: string;
	allowedOrigins: ReadonlySet<string>;
};

export type TurnstileVerification = {
	success: boolean;
	action?: string;
	hostname?: string;
	errorCodes?: string[];
};

export type WorkerLogEntry = {
	requestId: string;
	route: string;
	method: string;
	status: number;
	outcome: string;
	durationMs: number;
};

export type WorkerDependencies = {
	rateLimit(key: string): Promise<{ success: boolean }>;
	verifyTurnstile(input: {
		secret: string;
		token: string;
		remoteIp?: string;
		requestId: string;
	}): Promise<TurnstileVerification>;
	enqueueDelivery(delivery: QueuedDelivery): Promise<void>;
	log(entry: WorkerLogEntry): void;
	createRequestId(): string;
	now(): number;
};

class RequestError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly details?: Array<{ path: string; message: string }>,
		readonly headers?: HeadersInit
	) {
		super(message);
	}
}

const routes = new Map<string, { kind: RequestKind; action: string; schema: ZodType<FormRequest> }>(
	[
		['/contact', { kind: 'contact', action: 'contact', schema: contactRequestSchema }],
		['/inquiry', { kind: 'inquiry', action: 'inquiry', schema: inquiryRequestSchema }]
	]
);

function corsHeaders(origin: string, requestId: string): Headers {
	return new Headers({
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '86400',
		Vary: 'Origin',
		'X-Request-Id': requestId
	});
}

function jsonResponse(
	payload: unknown,
	status: number,
	origin: string,
	requestId: string,
	additionalHeaders?: HeadersInit
): Response {
	const headers = corsHeaders(origin, requestId);
	for (const [name, value] of new Headers(additionalHeaders)) headers.set(name, value);
	headers.set('Content-Type', 'application/json; charset=utf-8');
	headers.set('Cache-Control', 'no-store');
	return new Response(JSON.stringify(payload), { status, headers });
}

async function readBoundedJson(request: Request): Promise<unknown> {
	const declaredLength = Number(request.headers.get('Content-Length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
		throw new RequestError(413, 'PAYLOAD_TOO_LARGE', 'Request payload is too large.');
	}
	if (!request.body) {
		throw new RequestError(400, 'INVALID_JSON', 'Request body must contain valid JSON.');
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		totalBytes += value.byteLength;
		if (totalBytes > MAX_BODY_BYTES) {
			await reader.cancel();
			throw new RequestError(413, 'PAYLOAD_TOO_LARGE', 'Request payload is too large.');
		}
		chunks.push(value);
	}

	const body = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	try {
		return JSON.parse(new TextDecoder().decode(body));
	} catch {
		throw new RequestError(400, 'INVALID_JSON', 'Request body must contain valid JSON.');
	}
}

function validateOrigin(request: Request, config: WorkerConfig): string {
	const origin = request.headers.get('Origin');
	if (!origin || !config.allowedOrigins.has(origin)) {
		throw new RequestError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.');
	}
	return origin;
}

function isJsonMediaType(contentType: string | null): boolean {
	return contentType?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

async function processRequest(
	request: Request,
	config: WorkerConfig,
	dependencies: WorkerDependencies,
	requestId: string
): Promise<Response> {
	const origin = validateOrigin(request, config);
	const route = routes.get(new URL(request.url).pathname);
	if (!route) {
		throw new RequestError(404, 'NOT_FOUND', 'Endpoint not found.');
	}

	if (request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders(origin, requestId) });
	}
	if (request.method !== 'POST') {
		throw new RequestError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
	}
	if (!isJsonMediaType(request.headers.get('Content-Type'))) {
		throw new RequestError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
	}

	const remoteIp = request.headers.get('CF-Connecting-IP')?.trim() || undefined;
	let rateLimitResult: { success: boolean };
	try {
		rateLimitResult = await dependencies.rateLimit(`${route.kind}:${remoteIp ?? 'unknown'}`);
	} catch {
		throw new RequestError(
			503,
			'RATE_LIMIT_UNAVAILABLE',
			'Request could not be accepted at this time.'
		);
	}
	if (!rateLimitResult.success) {
		throw new RequestError(429, 'RATE_LIMITED', 'Too many requests. Try again later.', undefined, {
			'Retry-After': '60'
		});
	}

	const parsed = route.schema.safeParse(await readBoundedJson(request));
	if (!parsed.success) {
		throw new RequestError(
			400,
			'VALIDATION_FAILED',
			'Request validation failed.',
			parsed.error.issues.map((issue) => ({
				path: issue.path.join('.'),
				message: issue.message
			}))
		);
	}

	let verification: TurnstileVerification;
	try {
		verification = await dependencies.verifyTurnstile({
			secret: config.turnstileSecret,
			token: parsed.data.turnstileToken,
			remoteIp,
			requestId
		});
	} catch {
		throw new RequestError(
			502,
			'VERIFICATION_UNAVAILABLE',
			'Human verification is temporarily unavailable.'
		);
	}
	if (
		!verification.success ||
		verification.action !== route.action ||
		verification.hostname !== new URL(origin).hostname
	) {
		throw new RequestError(403, 'VERIFICATION_FAILED', 'Human verification failed.');
	}

	const delivery = createQueuedDelivery(
		route.kind,
		parsed.data,
		requestId,
		new Date(dependencies.now())
	);
	try {
		await dependencies.enqueueDelivery(delivery);
	} catch {
		throw new RequestError(
			503,
			'DELIVERY_UNAVAILABLE',
			'Request could not be accepted for delivery.'
		);
	}

	return jsonResponse({ ok: true }, 202, origin, requestId);
}

export async function handleRequest(
	request: Request,
	config: WorkerConfig,
	dependencies: WorkerDependencies
): Promise<Response> {
	const requestId = dependencies.createRequestId();
	const startedAt = dependencies.now();
	let status = 500;
	let outcome = 'INTERNAL_ERROR';

	try {
		const response = await processRequest(request, config, dependencies, requestId);
		status = response.status;
		outcome = response.ok ? 'SUCCESS' : 'ERROR';
		return response;
	} catch (error) {
		const origin = request.headers.get('Origin');
		if (error instanceof RequestError) {
			status = error.status;
			outcome = error.code;
			const payload = {
				error: {
					code: error.code,
					message: error.message,
					...(error.details ? { details: error.details } : {})
				},
				requestId
			};
			if (origin && config.allowedOrigins.has(origin)) {
				return jsonResponse(payload, status, origin, requestId, error.headers);
			}
			const headers = new Headers(error.headers);
			headers.set('Content-Type', 'application/json; charset=utf-8');
			headers.set('Cache-Control', 'no-store');
			headers.set('X-Request-Id', requestId);
			return new Response(JSON.stringify(payload), {
				status,
				headers
			});
		}

		const payload = {
			error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
			requestId
		};
		if (origin && config.allowedOrigins.has(origin)) {
			return jsonResponse(payload, status, origin, requestId);
		}
		return new Response(JSON.stringify(payload), {
			status,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Cache-Control': 'no-store',
				'X-Request-Id': requestId
			}
		});
	} finally {
		dependencies.log({
			requestId,
			route: new URL(request.url).pathname,
			method: request.method,
			status,
			outcome,
			durationMs: Math.max(0, dependencies.now() - startedAt)
		});
	}
}
