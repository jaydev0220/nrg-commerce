import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { createErrorHandler } from '../../src/errors/error-handler.js';
import type { ApiLogger } from '../../src/logging/logger.js';
import { createRequestLogger } from '../../src/middlewares/request-logging.js';
import { createRequestContextMiddleware } from '../../src/middlewares/request-context.js';
import type { LogService } from '../../src/modules/management/log/log.service.js';
import { requestApp } from '../helpers/http.js';

type LoggerRecord = {
	level: string;
	metadata: Record<string, unknown>;
	message: string;
};

function createTestLogger() {
	const records: LoggerRecord[] = [];
	const record = (level: string, metadata: Record<string, unknown>, message: string) => {
		records.push({ level, metadata, message });
	};

	return {
		records,
		logger: {
			debug: (metadata, message) => record('debug', metadata, message),
			info: (metadata, message) => record('info', metadata, message),
			warn: (metadata, message) => record('warn', metadata, message),
			error: (metadata, message) => record('error', metadata, message),
			fatal: (metadata, message) => record('fatal', metadata, message)
		} satisfies ApiLogger
	};
}

function createRequestLogService() {
	const records: Array<Parameters<LogService['recordRequestLog']>[0]> = [];
	return {
		records,
		logService: {
			recordRequestLog: async (input: Parameters<LogService['recordRequestLog']>[0]) => {
				records.push(input);
			}
		}
	};
}

test('records one sanitized completion event with request and staff context', async () => {
	const { logger, records: loggerRecords } = createTestLogger();
	const { logService, records } = createRequestLogService();
	let now = 100;
	const requestLogger = createRequestLogger({
		logger,
		logService,
		minimumLevel: 'debug',
		now: () => now
	});
	const app = express();

	app.use(createRequestContextMiddleware(() => 'request-123'));
	app.use(requestLogger.middleware);
	app.use((_request, response, next) => {
		response.locals['auth'] = { staffId: 'staff-123' };
		next();
	});
	app.get('/products', (_request, response) => {
		now = 107;
		response.status(204).end();
	});

	await requestApp(app, { path: '/products?token=private-token' });

	assert.equal(loggerRecords.length, 1);
	assert.deepEqual(loggerRecords[0], {
		level: 'debug',
		message: 'API request completed.',
		metadata: {
			requestId: 'request-123',
			method: 'GET',
			path: '/products',
			statusCode: 204,
			durationMs: 7,
			actorStaffId: 'staff-123'
		}
	});
	assert.equal(records.length, 1);
	assert.equal(records[0]?.path, '/products');
	assert.equal(records[0]?.requestId, 'request-123');
	assert.deepEqual(records[0]?.metadata, { durationMs: 7 });
});

test('suppresses successful health checks but records health failures', async () => {
	const { logger, records: loggerRecords } = createTestLogger();
	const { logService, records } = createRequestLogService();
	const requestLogger = createRequestLogger({ logger, logService, minimumLevel: 'debug' });
	const app = express();

	app.use(createRequestContextMiddleware(() => 'health-request'));
	app.use(requestLogger.middleware);
	app.get('/health/liveness', (_request, response) => response.status(200).json({ status: 'ok' }));
	app.get('/health/readiness', (_request, response) =>
		response.status(503).json({ status: 'not-ready' })
	);

	await requestApp(app, { path: '/health/liveness' });
	await requestApp(app, { path: '/health/readiness' });

	assert.equal(loggerRecords.length, 1);
	assert.equal(loggerRecords[0]?.level, 'error');
	assert.equal(loggerRecords[0]?.metadata['statusCode'], 503);
	assert.equal(records.length, 1);
});

test('uses warn severity for client errors', async () => {
	const { logger, records: loggerRecords } = createTestLogger();
	const { logService } = createRequestLogService();
	const requestLogger = createRequestLogger({ logger, logService, minimumLevel: 'debug' });
	const app = express();

	app.use(createRequestContextMiddleware(() => 'client-error'));
	app.use(requestLogger.middleware);
	app.get('/invalid', (_request, response) => response.status(422).end());

	await requestApp(app, { path: '/invalid' });

	assert.equal(loggerRecords.length, 1);
	assert.equal(loggerRecords[0]?.level, 'warn');
});

test('records unexpected errors once with sanitized exception context', async () => {
	const { logger, records: loggerRecords } = createTestLogger();
	const { logService, records } = createRequestLogService();
	let now = 200;
	const requestLogger = createRequestLogger({
		logger,
		logService,
		minimumLevel: 'debug',
		now: () => now
	});
	const app = express();

	app.use(createRequestContextMiddleware(() => 'error-request'));
	app.use(requestLogger.middleware);
	app.get('/failure', () => {
		now = 215;
		throw Object.assign(new Error('database token=private-token'), {
			code: 'P2022',
			meta: { modelName: 'Order', password: 'private-password' }
		});
	});
	app.use(createErrorHandler(() => undefined, requestLogger.recordError));

	const response = await requestApp(app, { path: '/failure?secret=query-secret' });

	assert.equal(response.status, 500);
	assert.equal(loggerRecords.length, 1);
	assert.equal(loggerRecords[0]?.level, 'error');
	const errorMetadata = loggerRecords[0]?.metadata['error'] as Record<string, unknown>;
	assert.equal(errorMetadata['name'], 'Error');
	assert.equal(errorMetadata['message'], 'database token=[REDACTED]');
	assert.equal(errorMetadata['code'], 'P2022');
	assert.deepEqual(errorMetadata['meta'], {
		modelName: 'Order',
		password: '[REDACTED]'
	});
	assert.match(String(errorMetadata['stack']), /database token=\[REDACTED\]/);
	assert.doesNotMatch(
		JSON.stringify(loggerRecords[0]),
		/private-token|private-password|query-secret/
	);
	assert.equal(records.length, 1);
	assert.equal(records[0]?.level, 'error');
});

test('does not let database logging failures affect the response', async () => {
	const { logger, records } = createTestLogger();
	const requestLogger = createRequestLogger({
		logger,
		logService: {
			recordRequestLog: async () => {
				throw new Error('database token=private-token');
			}
		},
		minimumLevel: 'debug'
	});
	const app = express();

	app.use(createRequestContextMiddleware(() => 'persistence-failure'));
	app.use(requestLogger.middleware);
	app.get('/healthy', (_request, response) => response.status(200).end());

	const response = await requestApp(app, { path: '/healthy' });

	assert.equal(response.status, 200);
	await new Promise<void>((resolve) => setImmediate(resolve));
	assert.equal(records.length, 2);
	assert.equal(records[0]?.level, 'debug');
	assert.equal(records[1]?.level, 'error');
	assert.doesNotMatch(JSON.stringify(records[1]), /private-token/);
});

test('does not emit debug requests when the configured minimum is info', async () => {
	const { logger, records: loggerRecords } = createTestLogger();
	const { logService, records } = createRequestLogService();
	const requestLogger = createRequestLogger({ logger, logService, minimumLevel: 'info' });
	const app = express();

	app.use(createRequestContextMiddleware(() => 'filtered-request'));
	app.use(requestLogger.middleware);
	app.get('/products', (_request, response) => response.status(200).end());

	await requestApp(app, { path: '/products' });

	assert.equal(loggerRecords.length, 0);
	assert.equal(records.length, 0);
});
