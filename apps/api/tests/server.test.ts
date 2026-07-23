import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { configureHttpServer, createShutdownController } from '../src/server.js';

function createTimeout(): NodeJS.Timeout {
	return { unref() {} } as NodeJS.Timeout;
}

test('HTTP server limits slow requests, header volume, and socket reuse', () => {
	const server = createServer();

	configureHttpServer(server);

	assert.equal(server.requestTimeout, 30_000);
	assert.equal(server.headersTimeout, 15_000);
	assert.equal(server.keepAliveTimeout, 5_000);
	assert.equal(server.maxHeadersCount, 100);
	assert.equal(server.maxRequestsPerSocket, 1_000);
});

test('graceful shutdown closes HTTP and database resources once', async () => {
	let closeCalls = 0;
	let closeIdleCalls = 0;
	let databaseCloseCalls = 0;
	let clearTimeoutCalls = 0;
	let cleanupCalls = 0;
	let observabilityShutdownCalls = 0;
	const exitCodes: number[] = [];
	const output: string[] = [];
	const timeout = createTimeout();
	const controller = createShutdownController({
		server: {
			close(callback) {
				closeCalls += 1;
				callback?.();
			},
			closeIdleConnections() {
				closeIdleCalls += 1;
			}
		},
		closeDatabase: async () => {
			databaseCloseCalls += 1;
		},
		cleanup: () => {
			cleanupCalls += 1;
		},
		shutdownObservability: async () => {
			observabilityShutdownCalls += 1;
		},
		exit: (code) => exitCodes.push(code),
		setShutdownTimeout: () => timeout,
		clearShutdownTimeout: (value) => {
			assert.equal(value, timeout);
			clearTimeoutCalls += 1;
		},
		writeOutput: (message) => output.push(message)
	});

	const firstShutdown = controller.shutdown('SIGTERM');
	const secondShutdown = controller.shutdown('SIGINT');
	assert.equal(firstShutdown, secondShutdown);
	await firstShutdown;

	assert.equal(closeCalls, 1);
	assert.equal(closeIdleCalls, 1);
	assert.equal(databaseCloseCalls, 1);
	assert.equal(cleanupCalls, 1);
	assert.equal(observabilityShutdownCalls, 1);
	assert.equal(clearTimeoutCalls, 1);
	assert.deepEqual(exitCodes, [0]);
	assert.deepEqual(output, ['@apps/api received SIGTERM; shutting down.\n']);
});

test('graceful shutdown reports close failures and exits unsuccessfully', async () => {
	const errors: string[] = [];
	const exitCodes: number[] = [];
	const controller = createShutdownController({
		server: {
			close(callback) {
				callback?.(new Error('close failed'));
			},
			closeIdleConnections() {}
		},
		closeDatabase: async () => undefined,
		exit: (code) => exitCodes.push(code),
		setShutdownTimeout: createTimeout,
		writeOutput: () => undefined,
		writeError: (message) => errors.push(message)
	});

	await controller.shutdown('SIGTERM');

	assert.deepEqual(exitCodes, [1]);
	assert.deepEqual(errors, ['@apps/api graceful shutdown failed: close failed\n']);
});

test('graceful shutdown does not swallow a falsy cleanup rejection', async () => {
	const errors: string[] = [];
	const exitCodes: number[] = [];
	const controller = createShutdownController({
		server: {
			close(callback) {
				callback?.();
			},
			closeIdleConnections() {}
		},
		cleanup: () => {
			throw undefined;
		},
		closeDatabase: async () => undefined,
		exit: (code) => exitCodes.push(code),
		setShutdownTimeout: createTimeout,
		writeOutput: () => undefined,
		writeError: (message) => errors.push(message)
	});

	await controller.shutdown('SIGTERM');

	assert.deepEqual(exitCodes, [1]);
	assert.deepEqual(errors, ['@apps/api graceful shutdown failed: Unknown error\n']);
});

test('graceful shutdown timeout forces an unsuccessful exit', () => {
	let timeoutCallback: (() => void) | undefined;
	const exitCodes: number[] = [];
	const errors: string[] = [];
	const controller = createShutdownController({
		server: {
			close() {},
			closeIdleConnections() {}
		},
		exit: (code) => exitCodes.push(code),
		setShutdownTimeout: (callback) => {
			timeoutCallback = callback;
			return createTimeout();
		},
		writeOutput: () => undefined,
		writeError: (message) => errors.push(message)
	});

	void controller.shutdown('SIGTERM');
	timeoutCallback?.();

	assert.deepEqual(exitCodes, [1]);
	assert.deepEqual(errors, ['@apps/api graceful shutdown timed out.\n']);
});
