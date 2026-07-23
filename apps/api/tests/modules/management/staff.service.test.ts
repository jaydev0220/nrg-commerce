import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createStaffService } from '../../../src/modules/management/staff/staff.service.js';

const actingAdmin = {
	id: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
	roles: ['admin']
};

type StaffRepository = Parameters<typeof createStaffService>[0]['repository'];

function createStaffRepository(overrides: Partial<StaffRepository> = {}): StaffRepository {
	return {
		listStaff: async () => ({ data: [], total: 0 }),
		findById: async () => null,
		findAnyById: async () => null,
		listRoles: async () => [],
		createStaff: async () => {
			throw new Error('not used');
		},
		updateStaff: async () => {
			throw new Error('not used');
		},
		deleteStaff: async () => {
			throw new Error('not used');
		},
		restoreStaff: async () => {
			throw new Error('not used');
		},
		resetMfa: async () => undefined,
		setPassword: async () => undefined,
		roleIdsExist: async () => true,
		emailExists: async () => false,
		...overrides
	};
}

test('deleteStaff prevents the current authenticated staff member from deleting themselves', async () => {
	const staffService = createStaffService({
		repository: {
			listStaff: async () => ({ data: [], total: 0 }),
			findById: async () => ({
				id: actingAdmin.id,
				email: 'admin@example.com',
				name: 'Admin',
				status: 'active',
				preferredMfaMethod: null,
				lastLoginAt: null,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				roles: []
			}),
			findAnyById: async () => null,
			listRoles: async () => [],
			createStaff: async () => {
				throw new Error('not used');
			},
			updateStaff: async () => {
				throw new Error('not used');
			},
			deleteStaff: async () => {
				throw new Error('not used');
			},
			restoreStaff: async () => {
				throw new Error('not used');
			},
			resetMfa: async () => undefined,
			setPassword: async () => undefined,
			roleIdsExist: async () => true,
			emailExists: async () => false
		},
		passwordHasher: {
			hash: async () => 'argon2-hash'
		}
	});

	await assert.rejects(
		() => staffService.deleteStaff(actingAdmin, actingAdmin.id),
		(error: unknown) => error instanceof AppError && error.statusCode === 409
	);
});

test('deleteStaff always archives the staff record', async () => {
	const staffId = '0189076c-4f2a-7fe1-b9fd-2d68df455222';
	let deleteArguments: unknown[] = [];
	const staffService = createStaffService({
		repository: createStaffRepository({
			findById: async () =>
				({
					id: staffId,
					email: 'staff@example.com',
					name: 'Staff',
					status: 'active',
					preferredMfaMethod: null,
					lastLoginAt: null,
					deletedAt: null,
					createdAt: new Date(),
					updatedAt: new Date(),
					roles: []
				}) as never,
			deleteStaff: async (...args) => {
				deleteArguments = args;
				return 'soft';
			}
		}),
		passwordHasher: { hash: async () => 'argon2-hash' }
	});

	assert.equal(await staffService.deleteStaff(actingAdmin, staffId), 'soft');
	assert.deepEqual(deleteArguments, [staffId]);
});

test('createStaff hashes and returns a generated initial password once', async () => {
	let passwordHash: string | undefined;
	const generatedPassword = 'Abcdefghijklmno1!2345678';
	const staffService = createStaffService({
		repository: {
			listStaff: async () => ({ data: [], total: 0 }),
			findById: async () => null,
			findAnyById: async () => null,
			listRoles: async () => [],
			createStaff: async (input) => {
				passwordHash = input.passwordHash;
				return {
					id: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
					email: input.email,
					name: input.name,
					status: 'inactive',
					preferredMfaMethod: null,
					lastLoginAt: null,
					deletedAt: null,
					createdAt: new Date(),
					updatedAt: new Date(),
					roles: []
				};
			},
			updateStaff: async () => {
				throw new Error('not used');
			},
			deleteStaff: async () => {
				throw new Error('not used');
			},
			restoreStaff: async () => {
				throw new Error('not used');
			},
			resetMfa: async () => undefined,
			setPassword: async () => undefined,
			roleIdsExist: async () => true,
			emailExists: async () => false
		},
		passwordHasher: { hash: async (password) => `hashed:${password}` },
		passwordGenerator: () => generatedPassword
	});

	const result = await staffService.createStaff(actingAdmin, {
		email: 'new@example.com',
		name: 'New Staff',
		roleIds: ['0189076c-4f2a-7fe1-b9fd-2d68df455333']
	});

	assert.equal(result.initialPassword, generatedPassword);
	assert.equal(passwordHash, `hashed:${generatedPassword}`);
});

test('non-admin staff managers cannot grant roles they do not hold', async () => {
	const adminRoleId = '0189076c-4f2a-7fe1-b9fd-2d68df455441';
	const catalogRoleId = '0189076c-4f2a-7fe1-b9fd-2d68df455442';
	const staffManagerRoleId = '0189076c-4f2a-7fe1-b9fd-2d68df455443';
	let createCalled = false;
	const staffService = createStaffService({
		repository: createStaffRepository({
			listRoles: async () =>
				[
					{ id: adminRoleId, key: 'admin', name: 'Administrator', permissions: [] },
					{ id: catalogRoleId, key: 'catalog-manager', name: 'Catalog Manager', permissions: [] },
					{
						id: staffManagerRoleId,
						key: 'staff-manager',
						name: 'Staff Manager',
						permissions: []
					}
				] as never,
			createStaff: async () => {
				createCalled = true;
				return {} as never;
			}
		}),
		passwordHasher: { hash: async () => 'argon2-hash' }
	});
	const actor = {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455444',
		roles: ['staff-manager']
	};
	const input = {
		email: 'new@example.com',
		name: 'New Staff'
	};

	await assert.rejects(
		() => staffService.createStaff(actor, { ...input, roleIds: [adminRoleId] }),
		(error: unknown) => error instanceof AppError && error.statusCode === 403
	);
	await assert.rejects(
		() => staffService.createStaff(actor, { ...input, roleIds: [catalogRoleId] }),
		(error: unknown) => error instanceof AppError && error.statusCode === 403
	);
	assert.equal(createCalled, false);
});

test('non-admin staff managers cannot mutate administrator accounts or their own roles', async () => {
	const actor = {
		id: '0189076c-4f2a-7fe1-b9fd-2d68df455444',
		roles: ['staff-manager']
	};
	const adminId = '0189076c-4f2a-7fe1-b9fd-2d68df455445';
	const staffManagerRoleId = '0189076c-4f2a-7fe1-b9fd-2d68df455443';
	const makeStaff = (id: string, roles: Array<{ id: string; key: 'admin' | 'staff-manager' }>) =>
		({
			id,
			email: 'staff@example.com',
			name: 'Staff',
			status: 'active',
			preferredMfaMethod: null,
			lastLoginAt: null,
			deletedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			roles: roles.map((role) => ({ ...role, name: role.key, permissions: [] }))
		}) as never;
	const staffService = createStaffService({
		repository: createStaffRepository({
			findById: async (staffId) =>
				staffId === adminId
					? makeStaff(adminId, [{ id: '0189076c-4f2a-7fe1-b9fd-2d68df455441', key: 'admin' }])
					: makeStaff(actor.id, [{ id: staffManagerRoleId, key: 'staff-manager' }]),
			listRoles: async () =>
				[
					{
						id: staffManagerRoleId,
						key: 'staff-manager',
						name: 'Staff Manager',
						permissions: []
					}
				] as never
		}),
		passwordHasher: { hash: async () => 'argon2-hash' }
	});

	await assert.rejects(
		() => staffService.updateStaff(actor, adminId, { name: 'Changed' }),
		(error: unknown) => error instanceof AppError && error.statusCode === 403
	);
	await assert.rejects(
		() => staffService.updateStaff(actor, actor.id, { roleIds: [staffManagerRoleId] }),
		(error: unknown) => error instanceof AppError && error.statusCode === 409
	);
});
