import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createStaffService } from '../../../src/modules/management/staff.service.js';

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
				mfaRequired: false,
				preferredMfaMethod: null,
				lastLoginAt: null,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				roles: []
			}),
			createStaff: async () => {
				throw new Error('not used');
			},
			updateStaff: async () => {
				throw new Error('not used');
			},
			deleteStaff: async () => {
				throw new Error('not used');
			},
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
				mfaRequired: false,
				preferredMfaMethod: null,
				lastLoginAt: null,
				deletedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				roles: []
			}),
			createStaff: async () => {
				throw new Error('not used');
			},
			updateStaff: async () => {
				throw new Error('not used');
			},
			deleteStaff: async () => {
				throw new Error('not used');
			},
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
