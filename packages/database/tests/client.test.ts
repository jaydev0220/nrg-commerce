import assert from 'node:assert/strict';
import test from 'node:test';

import {
	closeDatabaseClient,
	createDatabaseClient,
	getDatabaseClient,
	permissionKeys,
	resolveDatabaseUrl,
	roleDefinitions
} from '../src/index.js';

test('resolveDatabaseUrl prefers the explicit connection string', () => {
	const explicitConnectionString = 'postgresql://user:pass@localhost:5432/explicit';

	assert.equal(resolveDatabaseUrl(explicitConnectionString), explicitConnectionString);
});

test('createDatabaseClient returns a Prisma client instance without querying the database', async () => {
	const database = createDatabaseClient({
		connectionString: 'postgresql://user:pass@localhost:5432/test'
	});

	assert.equal(typeof database.$disconnect, 'function');

	await database.$disconnect();
});

test('getDatabaseClient memoizes the database client', async () => {
	const firstClient = getDatabaseClient({
		connectionString: 'postgresql://user:pass@localhost:5432/test'
	});
	const secondClient = getDatabaseClient();

	assert.equal(firstClient, secondClient);

	await closeDatabaseClient();
});

test('roleDefinitions only reference seeded permission keys', () => {
	const knownPermissionKeys = new Set(permissionKeys);

	for (const role of roleDefinitions) {
		for (const permissionKey of role.permissions) {
			assert.equal(knownPermissionKeys.has(permissionKey), true);
		}
	}
});
