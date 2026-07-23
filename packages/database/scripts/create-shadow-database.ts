import { pathToFileURL } from 'node:url';

import { Client } from 'pg';

type DatabaseTarget = {
	protocol: string;
	hostname: string;
	port: string;
	databaseName: string;
};

type DatabaseClient = Pick<Client, 'connect' | 'query' | 'end'>;
type DatabaseClientFactory = (connectionString: string) => DatabaseClient;

function parseDatabaseTarget(value: string, variableName: string): DatabaseTarget {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${variableName} must be a valid PostgreSQL URL.`);
	}

	if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
		throw new Error(`${variableName} must use the postgres or postgresql protocol.`);
	}

	let databaseName: string;
	try {
		databaseName = decodeURIComponent(url.pathname.slice(1));
	} catch {
		throw new Error(`${variableName} contains an invalid database name.`);
	}
	if (!/^[a-z][a-z0-9_]{0,62}$/u.test(databaseName)) {
		throw new Error(`${variableName} must select a simple lowercase database name.`);
	}

	return {
		protocol: url.protocol,
		hostname: url.hostname,
		port: url.port || '5432',
		databaseName
	};
}

function isDuplicateDatabaseError(error: unknown): boolean {
	return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42P04');
}

export async function createShadowDatabase(
	adminUrl: string,
	shadowUrl: string,
	createClient: DatabaseClientFactory = (connectionString) => new Client({ connectionString })
): Promise<'created' | 'exists'> {
	const admin = parseDatabaseTarget(adminUrl, 'SHADOW_DATABASE_ADMIN_URL');
	const shadow = parseDatabaseTarget(shadowUrl, 'SHADOW_DATABASE_URL');

	if (
		admin.protocol !== shadow.protocol ||
		admin.hostname !== shadow.hostname ||
		admin.port !== shadow.port
	) {
		throw new Error('The shadow and maintenance databases must be on the same PostgreSQL server.');
	}
	if (admin.databaseName === shadow.databaseName) {
		throw new Error('The shadow database must be separate from the maintenance database.');
	}

	const client = createClient(adminUrl);
	await client.connect();
	try {
		const existing = await client.query<{ exists: number }>(
			'SELECT 1 AS "exists" FROM pg_database WHERE datname = $1',
			[shadow.databaseName]
		);
		if (existing.rows.length > 0) return 'exists';

		try {
			await client.query(`CREATE DATABASE "${shadow.databaseName}"`);
		} catch (error) {
			if (!isDuplicateDatabaseError(error)) throw error;
			return 'exists';
		}
		return 'created';
	} finally {
		await client.end();
	}
}

async function main(): Promise<void> {
	const adminUrl = process.env['SHADOW_DATABASE_ADMIN_URL'];
	const shadowUrl = process.env['SHADOW_DATABASE_URL'];
	if (!adminUrl || !shadowUrl) {
		throw new Error('SHADOW_DATABASE_ADMIN_URL and SHADOW_DATABASE_URL are required.');
	}

	const result = await createShadowDatabase(adminUrl, shadowUrl);
	process.stdout.write(
		`Migration shadow database ${result === 'created' ? 'created' : 'already exists'}.\n`
	);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	await main().catch(() => {
		process.stderr.write('Failed to prepare the migration shadow database.\n');
		process.exitCode = 1;
	});
}
