import type { DatabaseClient, LogKind, LogLevel, Prisma } from '@packages/database';

import type { ManagedLogRecord } from '../../../types/management.js';

type LogSortField = 'createdAt' | 'expiresAt';

type CreateLogInput = {
	level: LogLevel;
	kind: LogKind;
	message: string;
	actorStaffId: string | null;
	requestId: string | null;
	method: string | null;
	path: string | null;
	statusCode: number | null;
	entityType: string | null;
	entityId: string | null;
	metadata: Prisma.InputJsonValue | null;
	expiresAt: Date;
};

type ListLogsInput = {
	page: number;
	limit: number;
	kind?: LogKind;
	level?: LogLevel;
	actorStaffId?: string;
	requestId?: string;
	sort: LogSortField;
	order: 'asc' | 'desc';
	now: Date;
};

type LogListResult = {
	data: ManagedLogRecord[];
	total: number;
};

function mapLogRecord(log: {
	id: string;
	level: LogLevel;
	kind: LogKind;
	message: string;
	actorStaffId: string | null;
	requestId: string | null;
	method: string | null;
	path: string | null;
	statusCode: number | null;
	entityType: string | null;
	entityId: string | null;
	metadata: Prisma.JsonValue | null;
	expiresAt: Date;
	createdAt: Date;
}): ManagedLogRecord {
	return {
		id: log.id,
		level: log.level,
		kind: log.kind,
		message: log.message,
		actorStaffId: log.actorStaffId,
		requestId: log.requestId,
		method: log.method,
		path: log.path,
		statusCode: log.statusCode,
		entityType: log.entityType,
		entityId: log.entityId,
		metadata: log.metadata,
		expiresAt: log.expiresAt,
		createdAt: log.createdAt
	};
}

function resolveLogOrderBy(sort: LogSortField, order: 'asc' | 'desc') {
	switch (sort) {
		case 'expiresAt':
			return { expiresAt: order } as const;
		case 'createdAt':
		default:
			return { createdAt: order } as const;
	}
}

export function createPrismaLogRepository(database: DatabaseClient) {
	return {
		async createLog(input: CreateLogInput): Promise<ManagedLogRecord> {
			const log = await database.log.create({
				data: {
					level: input.level,
					kind: input.kind,
					message: input.message,
					actorStaffId: input.actorStaffId,
					requestId: input.requestId,
					method: input.method,
					path: input.path,
					statusCode: input.statusCode,
					entityType: input.entityType,
					entityId: input.entityId,
					...(input.metadata === null ? {} : { metadata: input.metadata }),
					expiresAt: input.expiresAt
				}
			});

			return mapLogRecord(log);
		},

		async listLogs(input: ListLogsInput): Promise<LogListResult> {
			const where: Prisma.LogWhereInput = {
				expiresAt: {
					gt: input.now
				},
				...(input.kind ? { kind: input.kind } : {}),
				...(input.level ? { level: input.level } : {}),
				...(input.actorStaffId ? { actorStaffId: input.actorStaffId } : {}),
				...(input.requestId ? { requestId: input.requestId } : {})
			};
			const logs = await database.log.findMany({
				where,
				orderBy: resolveLogOrderBy(input.sort, input.order),
				skip: (input.page - 1) * input.limit,
				take: input.limit
			});
			const total = await database.log.count({ where });

			return {
				data: logs.map(mapLogRecord),
				total
			};
		},

		async deleteExpiredLogs(now: Date): Promise<number> {
			const result = await database.log.deleteMany({
				where: {
					expiresAt: {
						lte: now
					}
				}
			});

			return result.count;
		}
	};
}

export type LogRepository = ReturnType<typeof createPrismaLogRepository>;
