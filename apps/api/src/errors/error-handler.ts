import type { ErrorRequestHandler, Response } from 'express';
import { ZodError } from '@packages/schemas';

import { AppError } from './app-error.js';
import { getRequestContext } from '../middlewares/request-context.js';

type UnexpectedErrorReporter = (
	message: string,
	context: Record<string, unknown>,
	error: unknown
) => void;

type UnexpectedErrorRecorder = (response: Response, error: unknown) => void;

const requestBodyErrors = {
	'entity.parse.failed': {
		statusCode: 400,
		code: 'MALFORMED_JSON',
		message: 'Request body contains malformed JSON.'
	},
	'entity.too.large': {
		statusCode: 413,
		code: 'PAYLOAD_TOO_LARGE',
		message: 'Request body exceeds the allowed size.'
	},
	'encoding.unsupported': {
		statusCode: 415,
		code: 'UNSUPPORTED_CONTENT_ENCODING',
		message: 'Request body uses an unsupported content encoding.'
	},
	'charset.unsupported': {
		statusCode: 415,
		code: 'UNSUPPORTED_CHARSET',
		message: 'Request body uses an unsupported character set.'
	},
	'request.aborted': {
		statusCode: 400,
		code: 'REQUEST_BODY_ABORTED',
		message: 'Request body was not received completely.'
	},
	'request.size.invalid': {
		statusCode: 400,
		code: 'INVALID_CONTENT_LENGTH',
		message: 'Request body length is invalid.'
	}
} as const;

const databaseErrors = {
	P2002: {
		statusCode: 409,
		code: 'RESOURCE_CONFLICT',
		message: 'A record with the same unique value already exists.'
	},
	P2003: {
		statusCode: 409,
		code: 'RELATION_CONFLICT',
		message: 'The requested change conflicts with a related record.'
	},
	P2025: {
		statusCode: 404,
		code: 'RESOURCE_NOT_FOUND',
		message: 'The requested record could not be found.'
	},
	P2034: {
		statusCode: 409,
		code: 'CONCURRENT_MODIFICATION',
		message: 'The record changed while the request was being processed.'
	}
} as const;

function getRequestBodyError(error: unknown) {
	if (!error || typeof error !== 'object' || !('type' in error)) return null;
	const type = error.type;
	if (typeof type !== 'string' || !(type in requestBodyErrors)) return null;

	return requestBodyErrors[type as keyof typeof requestBodyErrors];
}

function getDatabaseError(error: unknown) {
	if (!error || typeof error !== 'object' || !('code' in error)) return null;
	const code = error.code;
	if (typeof code !== 'string' || !(code in databaseErrors)) return null;

	return databaseErrors[code as keyof typeof databaseErrors];
}

export function createErrorHandler(
	reportUnexpectedError: UnexpectedErrorReporter = console.error,
	recordUnexpectedError?: UnexpectedErrorRecorder
): ErrorRequestHandler {
	return (error, request, response, _next) => {
		void _next;
		const requestBodyError = getRequestBodyError(error);
		if (requestBodyError) {
			response.status(requestBodyError.statusCode).json({
				error: {
					code: requestBodyError.code,
					message: requestBodyError.message,
					details: null
				}
			});
			return;
		}

		if (error instanceof ZodError) {
			const details = error.issues.map((issue) => ({
				path: issue.path.join('.'),
				message: issue.message
			}));

			response.status(422).json({
				error: {
					code: 'VALIDATION_FAILED',
					message: 'Request validation failed.',
					details
				}
			});
			return;
		}

		if (error instanceof AppError) {
			response.status(error.statusCode).json({
				error: {
					code: error.code,
					message: error.message,
					details: error.details ?? null
				}
			});
			return;
		}

		const databaseError = getDatabaseError(error);
		if (databaseError) {
			response.status(databaseError.statusCode).json({
				error: {
					code: databaseError.code,
					message: databaseError.message,
					details: null
				}
			});
			return;
		}

		recordUnexpectedError?.(response, error);
		reportUnexpectedError(
			'Unhandled API request error.',
			{
				requestId: getRequestContext(request, response).requestId,
				method: request.method,
				path: request.originalUrl.split('?')[0] || request.path
			},
			error
		);

		response.status(500).json({
			error: {
				code: 'INTERNAL_SERVER_ERROR',
				message: 'An unexpected error occurred.',
				details: null
			}
		});
	};
}

export const errorHandler = createErrorHandler();
