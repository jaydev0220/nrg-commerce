import type { RequestHandler, Response } from 'express';

import { getOptionalAuthContext } from './authenticate.js';
import { getRequestContext, getRequestPath } from './request-context.js';
import { redactLogValue, serializeLogError } from '../logging/log-redaction.js';
import type { ApiLogger } from '../logging/logger.js';
import type { LogLevel } from '@packages/database';
import type { LogService } from '../modules/management/log/log.service.js';

const logLevelWeight: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
	fatal: 50
};

type RequestLoggingState = {
	requestId: string;
	startedAt: number;
	error?: unknown;
	completed: boolean;
};

type RequestLoggingLocals = {
	requestLogging?: RequestLoggingState;
};

type RequestLoggerDependencies = {
	logger: ApiLogger;
	logService: {
		recordRequestLog(
			input: Parameters<LogService['recordRequestLog']>[0]
		): Promise<unknown> | unknown;
	};
	minimumLevel: LogLevel;
	now?: () => number;
};

function isLevelEnabled(minimumLevel: LogLevel, level: LogLevel): boolean {
	return logLevelWeight[level] >= logLevelWeight[minimumLevel];
}

function resolveRequestLevel(statusCode: number): LogLevel {
	if (statusCode >= 500) return 'error';
	if (statusCode >= 400) return 'warn';
	return 'debug';
}

function isSuccessfulHealthCheck(path: string, statusCode: number): boolean {
	return (path === '/health' || path.startsWith('/health/')) && statusCode < 400;
}

function logAtLevel(
	logger: ApiLogger,
	level: LogLevel,
	metadata: Record<string, unknown>,
	message: string
): void {
	logger[level](metadata, message);
}

function getRequestLoggingState(response: Response): RequestLoggingState | undefined {
	return (response.locals as RequestLoggingLocals).requestLogging;
}

export function createRequestLogger(dependencies: RequestLoggerDependencies) {
	const now = dependencies.now ?? Date.now;

	const middleware: RequestHandler = (request, response, next) => {
		const requestContext = getRequestContext(request, response);
		const state: RequestLoggingState = {
			requestId: requestContext.requestId,
			startedAt: now(),
			completed: false
		};
		(response.locals as RequestLoggingLocals).requestLogging = state;

		const recordCompletion = (aborted: boolean) => {
			if (state.completed) return;
			state.completed = true;

			const path = getRequestPath(request);
			const statusCode = aborted && response.statusCode < 400 ? 499 : response.statusCode;
			if (isSuccessfulHealthCheck(path, statusCode)) return;

			const level = resolveRequestLevel(statusCode);
			if (!isLevelEnabled(dependencies.minimumLevel, level)) return;

			const durationMs = Math.max(0, now() - state.startedAt);
			const actorStaffId = getOptionalAuthContext(response)?.staffId;
			const metadata: Record<string, unknown> = {
				requestId: state.requestId,
				method: request.method,
				path,
				statusCode,
				durationMs,
				...(actorStaffId ? { actorStaffId } : {}),
				...(aborted ? { aborted: true } : {})
			};

			const error = state.error ? serializeLogError(state.error) : null;
			if (error) metadata['error'] = error;

			logAtLevel(dependencies.logger, level, metadata, 'API request completed.');

			const requestMetadata = redactLogValue({
				durationMs,
				...(aborted ? { aborted: true } : {}),
				...(error ? { error } : {})
			});

			void Promise.resolve()
				.then(() =>
					dependencies.logService.recordRequestLog({
						level,
						message: 'API request completed.',
						actorStaffId: actorStaffId ?? null,
						requestId: state.requestId,
						method: request.method,
						path,
						statusCode,
						metadata: requestMetadata
					})
				)
				.catch((error: unknown) => {
					dependencies.logger.error(
						{
							requestId: state.requestId,
							error: serializeLogError(error)
						},
						'Failed to persist API request log.'
					);
				});
		};

		response.once('finish', () => recordCompletion(false));
		response.once('close', () => {
			if (!response.writableFinished) recordCompletion(true);
		});
		next();
	};

	return {
		middleware,
		recordError(response: Response, error: unknown): void {
			const state = getRequestLoggingState(response);
			if (state) state.error = error;
		}
	};
}
