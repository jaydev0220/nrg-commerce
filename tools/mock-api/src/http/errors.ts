import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class MockHttpError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details: unknown;

	constructor(status: number, code: string, message: string, details: unknown = null) {
		super(message);
		this.name = 'MockHttpError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export function notFound(message = 'The requested record could not be found.'): never {
	throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', message);
}

export function conflict(code: string, message: string): never {
	throw new MockHttpError(409, code, message);
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
	next(
		new MockHttpError(404, 'NOT_FOUND', `No mock route matches ${request.method} ${request.path}.`)
	);
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
	void _next;
	if (error instanceof ZodError) {
		response.status(400).json({
			error: {
				code: 'VALIDATION_FAILED',
				message: 'Request validation failed.',
				details: error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
			}
		});
		return;
	}

	if (error instanceof MockHttpError) {
		response.status(error.status).json({
			error: { code: error.code, message: error.message, details: error.details }
		});
		return;
	}

	console.error(error);
	response.status(500).json({
		error: {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'An unexpected error occurred in the mock API.',
			details: null
		}
	});
};
