import type { Server } from 'node:http';

import { closeDatabaseClient } from '@packages/database';

import { createApp } from './app.js';
import type { AppConfig } from './config/app-config.js';

type ProcessSignal = 'SIGINT' | 'SIGTERM';

type ClosableServer = {
	close(callback?: (error?: Error) => void): void;
	closeIdleConnections(): void;
};

type ShutdownDependencies = {
	server: ClosableServer;
	closeDatabase?: () => Promise<void>;
	cleanup?: () => Promise<void> | void;
	shutdownObservability?: () => Promise<void>;
	exit?: (code: number) => void;
	setShutdownTimeout?: (callback: () => void, milliseconds: number) => NodeJS.Timeout;
	clearShutdownTimeout?: (timeout: NodeJS.Timeout) => void;
	writeOutput?: (message: string) => void;
	writeError?: (message: string) => void;
};

export type ShutdownController = {
	shutdown(signal: ProcessSignal): Promise<void>;
};

export function configureHttpServer(server: Server): void {
	server.requestTimeout = 30_000;
	server.headersTimeout = 15_000;
	server.keepAliveTimeout = 5_000;
	server.maxHeadersCount = 100;
	server.maxRequestsPerSocket = 1_000;
}

function closeServer(server: ShutdownDependencies['server']): Promise<void> {
	return new Promise((resolve, reject) => {
		server.close((error?: Error) => {
			if (error) {
				reject(error);
				return;
			}

			resolve();
		});
		server.closeIdleConnections();
	});
}

async function closeRuntimeResources(dependencies: ShutdownDependencies): Promise<void> {
	const closeDatabase = dependencies.closeDatabase ?? closeDatabaseClient;
	const operations = [
		() => closeServer(dependencies.server),
		() => dependencies.cleanup?.(),
		() => closeDatabase(),
		() => dependencies.shutdownObservability?.()
	];
	let hasError = false;
	let firstError: unknown;

	for (const operation of operations) {
		try {
			await operation();
		} catch (error) {
			if (!hasError) firstError = error;
			hasError = true;
		}
	}

	if (hasError) throw firstError;
}

export function createShutdownController(dependencies: ShutdownDependencies): ShutdownController {
	const exit = dependencies.exit ?? ((code) => process.exit(code));
	const setShutdownTimeout = dependencies.setShutdownTimeout ?? setTimeout;
	const clearShutdownTimeout = dependencies.clearShutdownTimeout ?? clearTimeout;
	const writeOutput = dependencies.writeOutput ?? ((message) => process.stdout.write(message));
	const writeError = dependencies.writeError ?? ((message) => process.stderr.write(message));
	let shutdownPromise: Promise<void> | undefined;

	return {
		shutdown(signal) {
			shutdownPromise ??= (async () => {
				writeOutput(`@apps/api received ${signal}; shutting down.\n`);
				const timeout = setShutdownTimeout(() => {
					writeError('@apps/api graceful shutdown timed out.\n');
					exit(1);
				}, 8_000);
				timeout.unref();

				try {
					await closeRuntimeResources(dependencies);
					clearShutdownTimeout(timeout);
					exit(0);
				} catch (error) {
					clearShutdownTimeout(timeout);
					writeError(
						`@apps/api graceful shutdown failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`
					);
					exit(1);
				}
			})();

			return shutdownPromise;
		}
	};
}

export function startApiServer(
	config: AppConfig,
	dependencies: Pick<ShutdownDependencies, 'shutdownObservability'> = {}
): Server {
	const cleanupCallbacks: Array<() => void> = [];
	const app = createApp({
		config,
		registerCleanup: (cleanup) => cleanupCallbacks.push(cleanup)
	});
	const server = app.listen(config.port, '0.0.0.0', () => {
		process.stdout.write(`@apps/api listening on port ${config.port}\n`);
	});
	configureHttpServer(server);
	const shutdownController = createShutdownController({
		server,
		cleanup: () => {
			for (const cleanup of cleanupCallbacks) cleanup();
		},
		shutdownObservability: dependencies.shutdownObservability
	});

	process.once('SIGINT', () => void shutdownController.shutdown('SIGINT'));
	process.once('SIGTERM', () => void shutdownController.shutdown('SIGTERM'));

	return server;
}
