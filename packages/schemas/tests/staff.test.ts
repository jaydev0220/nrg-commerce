import assert from 'node:assert/strict';
import test from 'node:test';

import { staffCreateSchema, staffListQuerySchema, staffSchema } from '../src/staff.js';

test('public staff parsing never returns a password digest', () => {
	const staff = staffSchema.parse({
		id: '93f99825-2962-4a10-b453-daa375ff1c43',
		email: 'staff@example.com',
		name: 'Staff member',
		status: 'active',
		passwordHash: '$argon2id$do-not-return',
		preferredMfaMethod: null,
		lastLoginAt: null,
		deletedAt: null,
		createdAt: '2026-07-22T00:00:00.000Z',
		updatedAt: '2026-07-22T00:00:00.000Z',
		roles: []
	});

	assert.equal('passwordHash' in staff, false);
});

test('staff request schemas reject oversized text and duplicate or excessive roles', () => {
	const roleId = '93f99825-2962-4a10-b453-daa375ff1c43';

	assert.throws(() =>
		staffCreateSchema.parse({
			email: 'staff@example.com',
			name: 'a'.repeat(201),
			roleIds: [roleId]
		})
	);
	assert.throws(() =>
		staffCreateSchema.parse({
			email: 'staff@example.com',
			name: 'Staff',
			roleIds: [roleId, roleId]
		})
	);
	assert.throws(() => staffListQuerySchema.parse({ search: 'a'.repeat(201) }));
});

test('staff request schemas canonicalize login email addresses', () => {
	const staff = staffCreateSchema.parse({
		email: ' Staff@Example.COM ',
		name: 'Staff',
		roleIds: ['93f99825-2962-4a10-b453-daa375ff1c43']
	});

	assert.equal(staff.email, 'staff@example.com');
});
