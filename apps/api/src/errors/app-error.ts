export type AppErrorOptions = {
	cause?: unknown;
	details?: unknown;
};

export class AppError extends Error {
	readonly code: string;
	readonly statusCode: number;
	readonly details?: unknown;

	constructor(statusCode: number, code: string, message: string, options: AppErrorOptions = {}) {
		super(message, { cause: options.cause });
		this.name = 'AppError';
		this.statusCode = statusCode;
		this.code = code;
		this.details = options.details;
	}
}
