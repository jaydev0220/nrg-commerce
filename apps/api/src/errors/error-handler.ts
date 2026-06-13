import type { ErrorRequestHandler } from 'express';
import { ZodError } from '@packages/schemas';

import { AppError } from './app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
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

	response.status(500).json({
		error: {
			code: 'INTERNAL_SERVER_ERROR',
			message: 'An unexpected error occurred.',
			details: null
		}
	});
};
