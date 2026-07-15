import type { LogLevel, Prisma } from '@packages/database';

import { AppError } from '../../../errors/app-error.js';
import { redactLogValue, redactSensitiveText } from '../../../logging/log-redaction.js';
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

function redactLogMetadata<T extends { message: string; metadata: Prisma.JsonValue | null }>(
	log: T
): T {
	return {
		...log,
		message: redactSensitiveText(log.message),
		metadata: redactLogValue(log.metadata)
	} as T;
}

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
				message: redactSensitiveText(input.message),
				actorStaffId: input.actorStaffId ?? null,
				requestId: input.requestId ?? null,
				method: input.method ?? null,
				path: input.path ?? null,
				statusCode: input.statusCode ?? null,
				entityType: input.entityType ?? null,
				entityId: input.entityId ?? null,
				metadata: redactLogValue(input.metadata),
				expiresAt: resolveLogExpiresAt(level, createdAt)
			});
		},

		recordRequestLog(input: Omit<AuditLogInput, 'level'> & { level: LogLevel }) {
			const createdAt = now();

			return dependencies.repository.createLog({
				level: input.level,
				kind: 'request',
				message: redactSensitiveText(input.message),
				actorStaffId: input.actorStaffId ?? null,
				requestId: input.requestId ?? null,
				method: input.method ?? null,
				path: input.path ?? null,
				statusCode: input.statusCode ?? null,
				entityType: input.entityType ?? null,
				entityId: input.entityId ?? null,
				metadata: redactLogValue(input.metadata),
				expiresAt: resolveLogExpiresAt(input.level, createdAt)
			});
		},

		listLogs(query: Omit<Parameters<LogRepository['listLogs']>[0], 'now'>) {
			return dependencies.repository
				.listLogs({
					...query,
					now: now()
				})
				.then((result) => ({ ...result, data: result.data.map(redactLogMetadata) }));
		},

		async getLog(logId: string) {
			const log = await dependencies.repository.findLogById(logId, now());
			if (!log)
				throw new AppError(404, 'LOG_NOT_FOUND', 'The requested log record could not be found.');
			return redactLogMetadata(log);
		},

		pruneExpiredLogs() {
			return dependencies.repository.deleteExpiredLogs(now());
		}
	};
}

export type LogService = ReturnType<typeof createLogService>;
