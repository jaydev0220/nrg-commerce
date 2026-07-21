import assert from 'node:assert/strict';
import test from 'node:test';

import { createShutdownController } from '../src/server.js';

function createTimeout(): NodeJS.Timeout {
	return { unref() {} } as NodeJS.Timeout;
}

test('graceful shutdown closes HTTP and database resources once', async () => {
	let closeCalls = 0;
	let closeIdleCalls = 0;
	let databaseCloseCalls = 0;
	let clearTimeoutCalls = 0;
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
		exit: (code) => exitCodes.push(code),
		setShutdownTimeout: createTimeout,
		writeOutput: () => undefined,
		writeError: (message) => errors.push(message)
	});

	await controller.shutdown('SIGTERM');

	assert.deepEqual(exitCodes, [1]);
	assert.deepEqual(errors, ['@apps/api graceful shutdown failed: close failed\n']);
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
