import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
	initialPasswordResponseSchema,
	managedRoleResponseSchema,
	managedStaffResponseSchema,
	paginatedResponseSchema,
	staffCreateSchema,
	staffCreatedResponseSchema,
	staffListQuerySchema,
	staffUpdateSchema,
	z
} from '@packages/schemas';
import { conflict, notFound } from '../http/errors.js';
import { compareValues, paginate } from '../http/pagination.js';
import { parseBody, parseQuery, sendJson } from '../http/validation.js';
import type { MockState } from '../state.js';
import { assertDomainHealthy } from './shared.js';

function findStaff(state: MockState, staffId: string) {
	return state.staff.find((staff) => staff.id === staffId) ?? notFound();
}

function rolesFor(state: MockState, roleIds: string[]) {
	const roles = roleIds.map(
		(roleId) =>
			state.roles.find((role) => role.id === roleId) ??
			notFound('The selected role could not be found.')
	);
	return roles;
}

function ensureUniqueEmail(state: MockState, email: string, staffId?: string): void {
	const normalized = email.toLocaleLowerCase();
	if (
		state.staff.some(
			(staff) => staff.id !== staffId && staff.email.toLocaleLowerCase() === normalized
		)
	) {
		conflict('RESOURCE_CONFLICT', 'A staff account with this email already exists.');
	}
}

function temporaryPassword(): string {
	return `Mock-${randomUUID()}-A1!`;
}

export function createStaffRouter(state: MockState): Router {
	const router = Router();

	router.get('/roles', (_request, response) => {
		assertDomainHealthy(state, 'staff');
		sendJson(response, z.array(managedRoleResponseSchema), state.roles);
	});

	router.get('/', (request, response) => {
		assertDomainHealthy(state, 'staff');
		const query = parseQuery(request, staffListQuerySchema);
		const search = query.search?.toLocaleLowerCase();
		let staffRecords = state.staff.filter((staff) => {
			if (!query.includeDeleted && staff.deletedAt) return false;
			if (query.archived !== undefined && Boolean(staff.deletedAt) !== query.archived) return false;
			if (query.status && staff.status !== query.status) return false;
			if (query.roleId && !staff.roles.some((role) => role.id === query.roleId)) return false;
			if (!search) return true;
			return [staff.name, staff.email].some((value) => value.toLocaleLowerCase().includes(search));
		});
		staffRecords = [...staffRecords].sort((left, right) =>
			compareValues(left[query.sort], right[query.sort], query.order)
		);
		const page = paginate(staffRecords, query);
		sendJson(response, paginatedResponseSchema(managedStaffResponseSchema), page);
	});

	router.post('/', (request, response) => {
		assertDomainHealthy(state, 'staff');
		const input = parseBody(request, staffCreateSchema);
		ensureUniqueEmail(state, input.email);
		const now = new Date();
		const staff = {
			id: randomUUID(),
			email: input.email,
			name: input.name,
			status: 'active' as const,
			preferredMfaMethod: null,
			lastLoginAt: null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
			roles: rolesFor(state, input.roleIds)
		};
		state.staff.push(staff);
		sendJson(
			response,
			staffCreatedResponseSchema,
			{
				staff,
				initialPassword: temporaryPassword()
			},
			201
		);
	});

	router.patch('/:staffId', (request, response) => {
		assertDomainHealthy(state, 'staff');
		const input = parseBody(request, staffUpdateSchema);
		const staff = findStaff(state, request.params['staffId'] ?? '');
		if (input.email) ensureUniqueEmail(state, input.email, staff.id);
		if (input.email !== undefined) staff.email = input.email;
		if (input.name !== undefined) staff.name = input.name;
		if (input.status !== undefined) staff.status = input.status;
		if (input.roleIds !== undefined) staff.roles = rolesFor(state, input.roleIds);
		staff.updatedAt = new Date();
		sendJson(response, managedStaffResponseSchema, staff);
	});

	router.delete('/:staffId', (request, response) => {
		assertDomainHealthy(state, 'staff');
		const staff = findStaff(state, request.params['staffId'] ?? '');
		if (staff.id === state.currentStaffId) {
			conflict('RELATION_CONFLICT', 'The mock administrator cannot delete itself.');
		}
		staff.deletedAt = new Date();
		staff.updatedAt = staff.deletedAt;
		response.status(204).end();
	});

	router.post('/:staffId/restore', (request, response) => {
		assertDomainHealthy(state, 'staff');
		const staff = findStaff(state, request.params['staffId'] ?? '');
		staff.deletedAt = null;
		staff.updatedAt = new Date();
		sendJson(response, managedStaffResponseSchema, staff);
	});

	router.post('/:staffId/mfa/reset', (request, response) => {
		assertDomainHealthy(state, 'staff');
		const staff = findStaff(state, request.params['staffId'] ?? '');
		staff.preferredMfaMethod = null;
		staff.updatedAt = new Date();
		response.status(204).end();
	});

	router.post('/:staffId/password/reset', (request, response) => {
		assertDomainHealthy(state, 'staff');
		findStaff(state, request.params['staffId'] ?? '');
		sendJson(response, initialPasswordResponseSchema, { initialPassword: temporaryPassword() });
	});

	return router;
}
