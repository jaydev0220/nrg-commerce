import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const fallbackDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/nrg_commerce';

export type CreateDatabaseClientOptions = {
	connectionString?: string;
	maxConnections?: number;
	pool?: Pool;
};

export type DatabaseClient = PrismaClient;

let databaseClient: DatabaseClient | undefined;

export function resolveDatabaseUrl(connectionString?: string): string {
	return connectionString ?? process.env['DATABASE_URL'] ?? fallbackDatabaseUrl;
}

export function createDatabaseClient(options: CreateDatabaseClientOptions = {}): DatabaseClient {
	const pool =
		options.pool ??
		new Pool({
			connectionString: resolveDatabaseUrl(options.connectionString),
			max: options.maxConnections
		});

	return new PrismaClient({
		adapter: new PrismaPg(pool)
	});
}

export function getDatabaseClient(options: CreateDatabaseClientOptions = {}): DatabaseClient {
	databaseClient ??= createDatabaseClient(options);
	return databaseClient;
}

export async function closeDatabaseClient(): Promise<void> {
	if (!databaseClient) {
		return;
	}

	await databaseClient.$disconnect();
	databaseClient = undefined;
}
