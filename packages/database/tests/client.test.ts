import assert from 'node:assert/strict';
import test from 'node:test';

import {
	closeDatabaseClient,
	createDatabaseClient,
	getDatabaseClient,
	permissionKeys,
	resolveDatabaseUrl,
	roleDefinitions,
	roleKeys
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

	assert.deepEqual(
		roleDefinitions.map((role) => role.key),
		roleKeys
	);

	for (const role of roleDefinitions) {
		for (const permissionKey of role.permissions) {
			assert.equal(knownPermissionKeys.has(permissionKey), true);
		}
	}
});

test('administrator role receives log read permission', () => {
	const administratorRole = roleDefinitions.find((role) => role.key === 'admin');

	assert.ok(administratorRole);
	assert.equal(administratorRole.permissions.includes('log.read'), true);
});

test('read-only roles only receive their intended read permissions', () => {
	const readOnlyAdminRole = roleDefinitions.find((role) => role.key === 'read-only-admin');
	const readOnlyRole = roleDefinitions.find((role) => role.key === 'read-only');

	assert.ok(readOnlyAdminRole);
	assert.ok(readOnlyRole);
	assert.deepEqual(
		readOnlyAdminRole.permissions,
		permissionKeys.filter((key) => key.endsWith('.read'))
	);
	assert.deepEqual(
		readOnlyRole.permissions,
		permissionKeys.filter(
			(key) => key.endsWith('.read') && !key.startsWith('log') && !key.startsWith('staff')
		)
	);
});

test('manager roles only receive permissions for their own domain', () => {
	for (const domain of ['business', 'order', 'product'] as const) {
		const role = roleDefinitions.find((candidate) => candidate.key === `${domain}-manager`);

		assert.ok(role);
		assert.deepEqual(
			role.permissions,
			permissionKeys.filter((key) => key.startsWith(`${domain}.`))
		);
	}
});
