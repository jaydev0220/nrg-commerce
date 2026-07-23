import assert from 'node:assert/strict';
import test from 'node:test';

import { createPrismaStaffRepository } from '../../../src/modules/management/staff/staff.repository.js';

function createDatabaseDouble() {
	const operations: string[] = [];
	let transactionCount = 0;
	const staffRecord = {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
		email: 'staff@example.com',
		name: 'Staff',
		status: 'suspended' as const,
		preferredMfaMethod: null,
		lastLoginAt: null,
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		roles: []
	};
	const transaction = {
		staffRole: {
			deleteMany: async () => {
				operations.push('staffRole.deleteMany');
			},
			createMany: async () => {
				operations.push('staffRole.createMany');
			}
		},
		staff: {
			update: async () => {
				operations.push('staff.update');
				return staffRecord;
			}
		},
		authSession: {
			updateMany: async () => {
				operations.push('authSession.updateMany');
			}
		},
		refreshToken: {
			updateMany: async () => {
				operations.push('refreshToken.updateMany');
			}
		}
	};
	const database = {
		staff: {
			findFirst: async () => staffRecord,
			update: transaction.staff.update
		},
		$transaction: async (callback: (client: typeof transaction) => unknown) => {
			transactionCount += 1;
			return callback(transaction);
		}
	};

	return {
		database: database as never,
		operations,
		transactionCount: () => transactionCount
	};
}

test('updateStaff revokes active sessions when account access is disabled', async () => {
	const fixture = createDatabaseDouble();
	const repository = createPrismaStaffRepository(fixture.database);

	await repository.updateStaff('0189076c-4f2a-7fe1-b9fd-2d68df455222', {
		status: 'suspended'
	});

	assert.deepEqual(fixture.operations, [
		'staff.update',
		'authSession.updateMany',
		'refreshToken.updateMany'
	]);
	assert.equal(fixture.transactionCount(), 1);
});

test('deleteStaff archives the account and revokes sessions in one transaction', async () => {
	const fixture = createDatabaseDouble();
	const repository = createPrismaStaffRepository(fixture.database);

	assert.equal(await repository.deleteStaff('0189076c-4f2a-7fe1-b9fd-2d68df455222'), 'soft');

	assert.deepEqual(fixture.operations, [
		'staff.update',
		'authSession.updateMany',
		'refreshToken.updateMany'
	]);
	assert.equal(fixture.transactionCount(), 1);
});
