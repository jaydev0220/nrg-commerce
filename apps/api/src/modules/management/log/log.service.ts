import type { LogLevel } from '@packages/database';

import type { LogRepository } from './log.repository.js';

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export const logRetentionDaysByLevel = {
	debug: 7,
	info: 30,
	warn: 90,
	error: 180,
	fatal: 365
} as const satisfies Record<LogLevel, number>;

type LogServiceDependencies = {
	repository: LogRepository;
	now?: () => Date;
};

export function resolveLogExpiresAt(level: LogLevel, now = new Date()): Date {
	return new Date(now.getTime() + logRetentionDaysByLevel[level] * millisecondsPerDay);
}

export function createLogService(dependencies: LogServiceDependencies) {
	const now = dependencies.now ?? (() => new Date());

	return {
		listLogs(query: Omit<Parameters<LogRepository['listLogs']>[0], 'now'>) {
			return dependencies.repository.listLogs({
				...query,
				now: now()
			});
		},

		pruneExpiredLogs() {
			return dependencies.repository.deleteExpiredLogs(now());
		}
	};
}

export type LogService = ReturnType<typeof createLogService>;
