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

export function createErrorHandler(
	reportUnexpectedError: UnexpectedErrorReporter = console.error,
	recordUnexpectedError?: UnexpectedErrorRecorder
): ErrorRequestHandler {
	return (error, request, response, _next) => {
		void _next;

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
