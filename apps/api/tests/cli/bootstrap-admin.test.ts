import assert from 'node:assert/strict';
import test from 'node:test';

import type { DatabaseClient } from '@packages/database';

import { bootstrapAdministrator } from '../../src/cli/bootstrap-admin.js';

function createDatabase(overrides: { existingStaffId?: string; adminRoleId?: string | null }) {
	const createdStaff: Array<Record<string, unknown>> = [];
	const logs: Array<Record<string, unknown>> = [];
	const transaction = {
		staff: {
			findUnique: async () =>
				overrides.existingStaffId ? { id: overrides.existingStaffId } : null,
			create: async ({ data }: { data: Record<string, unknown> }) => {
				createdStaff.push(data);
				return { id: 'staff-1', email: data['email'] as string };
			}
		},
		role: {
			findUnique: async () =>
				overrides.adminRoleId === null ? null : { id: overrides.adminRoleId ?? 'admin-role' }
		},
		log: {
			create: async ({ data }: { data: Record<string, unknown> }) => {
				logs.push(data);
				return data;
			}
		}
	};
	const database = {
		$transaction: async (operation: (client: typeof transaction) => Promise<unknown>) =>
			operation(transaction)
	} as unknown as DatabaseClient;

	return { database, createdStaff, logs };
}

test('bootstrapAdministrator creates an active admin with a generated password and audit record', async () => {
	const { database, createdStaff, logs } = createDatabase({});
	const hashed: string[] = [];
	const now = new Date('2026-07-21T00:00:00.000Z');

	const result = await bootstrapAdministrator(
		database,
		{ email: ' ADMIN@Example.com ', name: ' Primary Admin ' },
		{
			generatePassword: () => 'Generated-Initial-Password-7!',
			hashPassword: async (password) => {
				hashed.push(password);
				return 'argon2-hash';
			},
			now: () => now
		}
	);

	assert.deepEqual(hashed, ['Generated-Initial-Password-7!']);
	assert.equal(result.initialPassword, 'Generated-Initial-Password-7!');
	assert.deepEqual(result.staff, { id: 'staff-1', email: 'admin@example.com' });
	assert.deepEqual(createdStaff, [
		{
			email: 'admin@example.com',
			name: 'Primary Admin',
			status: 'active',
			passwordHash: 'argon2-hash',
			roles: { create: { roleId: 'admin-role' } }
		}
	]);
	assert.equal(logs.length, 1);
	assert.deepEqual(logs[0]?.['metadata'], { source: 'bootstrap-admin' });
	assert.equal(logs[0]?.['entityId'], 'staff-1');
	assert.equal((logs[0]?.['expiresAt'] as Date).toISOString(), '2027-07-21T00:00:00.000Z');
});

test('bootstrapAdministrator refuses to modify an existing staff account', async () => {
	const { database, createdStaff, logs } = createDatabase({ existingStaffId: 'existing-staff' });

	await assert.rejects(
		bootstrapAdministrator(
			database,
			{ email: 'admin@example.com', name: 'Administrator' },
			{
				generatePassword: () => 'Generated-Initial-Password-7!',
				hashPassword: async () => 'argon2-hash'
			}
		),
		/A staff account with this email already exists/
	);

	assert.deepEqual(createdStaff, []);
	assert.deepEqual(logs, []);
});

test('bootstrapAdministrator requires seeded access-control roles', async () => {
	const { database, createdStaff, logs } = createDatabase({ adminRoleId: null });

	await assert.rejects(
		bootstrapAdministrator(
			database,
			{ email: 'admin@example.com', name: 'Administrator' },
			{
				generatePassword: () => 'Generated-Initial-Password-7!',
				hashPassword: async () => 'argon2-hash'
			}
		),
		/The admin role is missing/
	);

	assert.deepEqual(createdStaff, []);
	assert.deepEqual(logs, []);
});
