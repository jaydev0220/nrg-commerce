import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createStaffService } from '../../../src/modules/management/staff/staff.service.js';

const actingAdmin = {
	id: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
	roles: ['admin']
};

test('updatePassword requires the acting staff member to be an admin', async () => {
	const staffService = createStaffService({
		repository: {
			listStaff: async () => ({ data: [], total: 0 }),
			findById: async () => ({
				id: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
				email: 'staff@example.com',
				name: 'Staff',
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
		() =>
			staffService.updatePassword(
				{
					id: '0189076c-4f2a-7fe1-b9fd-2d68df455333',
					roles: ['staff-manager']
				},
				'0189076c-4f2a-7fe1-b9fd-2d68df455222',
				'correct horse battery staple'
			),
		(error: unknown) => error instanceof AppError && error.statusCode === 403
	);
});

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
		() => staffService.deleteStaff(actingAdmin, actingAdmin.id, false),
		(error: unknown) => error instanceof AppError && error.statusCode === 409
	);
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

	const result = await staffService.createStaff({
		email: 'new@example.com',
		name: 'New Staff',
		roleIds: ['0189076c-4f2a-7fe1-b9fd-2d68df455333']
	});

	assert.equal(result.initialPassword, generatedPassword);
	assert.equal(passwordHash, `hashed:${generatedPassword}`);
});
