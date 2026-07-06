import type { LogLevel, Prisma } from '@packages/database';

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

type AuditLogInput = {
	level?: LogLevel;
	message: string;
	actorStaffId?: string | null;
	requestId?: string | null;
	method?: string | null;
	path?: string | null;
	statusCode?: number | null;
	entityType?: string | null;
	entityId?: string | null;
	metadata?: Prisma.InputJsonValue | null;
};

export function resolveLogExpiresAt(level: LogLevel, now = new Date()): Date {
	return new Date(now.getTime() + logRetentionDaysByLevel[level] * millisecondsPerDay);
}

export function createLogService(dependencies: LogServiceDependencies) {
	const now = dependencies.now ?? (() => new Date());

	return {
		recordAuditLog(input: AuditLogInput) {
			const createdAt = now();
			const level = input.level ?? 'info';

			return dependencies.repository.createLog({
				level,
				kind: 'audit',
				message: input.message,
				actorStaffId: input.actorStaffId ?? null,
				requestId: input.requestId ?? null,
				method: input.method ?? null,
				path: input.path ?? null,
				statusCode: input.statusCode ?? null,
				entityType: input.entityType ?? null,
				entityId: input.entityId ?? null,
				metadata: input.metadata ?? null,
				expiresAt: resolveLogExpiresAt(level, createdAt)
			});
		},

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
