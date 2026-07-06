import type { LogService } from './log.service.js';

type LogRetentionPrunerDependencies = {
	logService: LogService;
	intervalMs?: number;
	runOnStart?: boolean;
	onError?: (error: unknown) => void;
};

type LogRetentionPruner = {
	stop(): void;
};

const defaultPruneIntervalMs = 60 * 60 * 1000;

export function startLogRetentionPruner(
	dependencies: LogRetentionPrunerDependencies
): LogRetentionPruner {
	const intervalMs = dependencies.intervalMs ?? defaultPruneIntervalMs;
	const onError = dependencies.onError ?? ((error) => console.error(error));
	const prune = () => {
		void dependencies.logService.pruneExpiredLogs().catch(onError);
	};

	if (dependencies.runOnStart ?? true) {
		prune();
	}

	const interval = setInterval(prune, intervalMs);
	interval.unref();

	return {
		stop() {
			clearInterval(interval);
		}
	};
}
