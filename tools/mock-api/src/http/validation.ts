import type { Request, Response } from 'express';
import type { ZodType } from 'zod';
import { MockHttpError } from './errors.js';

export function parseBody<T>(request: Request, schema: ZodType<T>): T {
	return schema.parse(request.body);
}

export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
	return schema.parse(request.query);
}

export function sendJson<T>(
	response: Response,
	schema: ZodType<T>,
	payload: unknown,
	status = 200
): void {
	const result = schema.safeParse(payload);
	if (!result.success) {
		throw new MockHttpError(
			500,
			'MOCK_RESPONSE_VALIDATION_FAILED',
			'Mock API response does not match the shared contract.',
			result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
		);
	}
	response.status(status).json(result.data);
}
