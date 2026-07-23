import { randomInt } from 'node:crypto';

import { AppError } from '../../../errors/app-error.js';
import type { PasswordHasher } from '../../../utils/password-hasher.js';
import type { StaffRepository } from './staff.repository.js';

type StaffServiceDependencies = {
	repository: Pick<
		StaffRepository,
		| 'listStaff'
		| 'findById'
		| 'findAnyById'
		| 'listRoles'
		| 'createStaff'
		| 'updateStaff'
		| 'deleteStaff'
		| 'restoreStaff'
		| 'resetMfa'
		| 'setPassword'
		| 'roleIdsExist'
		| 'emailExists'
	>;
	passwordHasher: Pick<PasswordHasher, 'hash'>;
	passwordGenerator?: () => string;
};

type ActingStaffContext = {
	id: string;
	roles: string[];
};

const passwordCharacterGroups = [
	'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
	'abcdefghijklmnopqrstuvwxyz',
	'0123456789',
	'!@#$%^&*()-_=+[]{}:,.?'
] as const;

function randomCharacter(characters: string): string {
	return characters[randomInt(characters.length)] ?? characters[0] ?? '';
}

export function generateInitialPassword(length = 24): string {
	if (length < 17) throw new Error('Generated passwords must be longer than 16 characters.');
	const allCharacters = passwordCharacterGroups.join('');
	const characters = passwordCharacterGroups.map(randomCharacter);

	while (characters.length < length) characters.push(randomCharacter(allCharacters));
	for (let index = characters.length - 1; index > 0; index -= 1) {
		const targetIndex = randomInt(index + 1);
		[characters[index], characters[targetIndex]] = [characters[targetIndex]!, characters[index]!];
	}

	return characters.join('');
}

export function createStaffService(dependencies: StaffServiceDependencies) {
	const generatePassword = dependencies.passwordGenerator ?? generateInitialPassword;
	const isAdmin = (actor: ActingStaffContext) => actor.roles.includes('admin');

	function assertCanManageTarget(
		actor: ActingStaffContext,
		staff: Awaited<ReturnType<StaffRepository['findById']>>
	): void {
		if (!staff || isAdmin(actor)) return;
		if (staff.roles.some((role) => role.key === 'admin')) {
			throw new AppError(
				403,
				'FORBIDDEN',
				'Only system administrators can manage administrator accounts.'
			);
		}
	}

	async function assertCanAssignRoles(actor: ActingStaffContext, roleIds: string[]): Promise<void> {
		if (isAdmin(actor)) return;

		const selectedRoles = (await dependencies.repository.listRoles()).filter((role) =>
			roleIds.includes(role.id)
		);
		if (
			selectedRoles.length !== roleIds.length ||
			selectedRoles.some((role) => !actor.roles.includes(role.key))
		) {
			throw new AppError(403, 'FORBIDDEN', 'Staff members cannot grant roles they do not hold.');
		}
	}

	return {
		listStaff(query: Parameters<StaffRepository['listStaff']>[0]) {
			return dependencies.repository.listStaff(query);
		},

		listRoles() {
			return dependencies.repository.listRoles();
		},

		async getStaff(staffId: string) {
			const staff = await dependencies.repository.findById(staffId);

			if (!staff) {
				throw new AppError(
					404,
					'STAFF_NOT_FOUND',
					'The requested staff record could not be found.'
				);
			}

			return staff;
		},

		async createStaff(
			actor: ActingStaffContext,
			input: { email: string; name: string; roleIds: string[] }
		) {
			if (await dependencies.repository.emailExists(input.email)) {
				throw new AppError(409, 'EMAIL_CONFLICT', 'The provided staff email is already in use.');
			}

			if (!(await dependencies.repository.roleIdsExist(input.roleIds))) {
				throw new AppError(404, 'ROLE_NOT_FOUND', 'One or more assigned roles could not be found.');
			}
			await assertCanAssignRoles(actor, input.roleIds);

			const initialPassword = generatePassword();
			const passwordHash = await dependencies.passwordHasher.hash(initialPassword);
			const staff = await dependencies.repository.createStaff({ ...input, passwordHash });

			return { staff, initialPassword };
		},

		async updateStaff(
			actor: ActingStaffContext,
			staffId: string,
			input: {
				email?: string;
				name?: string;
				roleIds?: string[];
				status?: 'active' | 'inactive' | 'suspended';
			}
		) {
			const existingStaff = await dependencies.repository.findById(staffId);

			if (!existingStaff) {
				throw new AppError(
					404,
					'STAFF_NOT_FOUND',
					'The requested staff record could not be found.'
				);
			}
			assertCanManageTarget(actor, existingStaff);

			if (actor.id === staffId && (input.email || input.roleIds)) {
				throw new AppError(
					409,
					'SELF_UPDATE_NOT_ALLOWED',
					'Staff members cannot change their own email or role assignments here.'
				);
			}

			if (input.email && (await dependencies.repository.emailExists(input.email, staffId))) {
				throw new AppError(409, 'EMAIL_CONFLICT', 'The provided staff email is already in use.');
			}

			if (input.roleIds && !(await dependencies.repository.roleIdsExist(input.roleIds))) {
				throw new AppError(404, 'ROLE_NOT_FOUND', 'One or more assigned roles could not be found.');
			}
			if (input.roleIds) await assertCanAssignRoles(actor, input.roleIds);

			if (actor.id === staffId) {
				if (input.status === 'inactive' || input.status === 'suspended') {
					throw new AppError(
						409,
						'SELF_UPDATE_NOT_ALLOWED',
						'Staff members cannot suspend or deactivate their own account.'
					);
				}
			}

			return dependencies.repository.updateStaff(staffId, input);
		},

		async deleteStaff(actor: ActingStaffContext, staffId: string) {
			const existingStaff = await dependencies.repository.findById(staffId);

			if (!existingStaff) {
				throw new AppError(
					404,
					'STAFF_NOT_FOUND',
					'The requested staff record could not be found.'
				);
			}

			if (actor.id === staffId) {
				throw new AppError(
					409,
					'SELF_DELETE_NOT_ALLOWED',
					'The current authenticated staff account cannot delete itself.'
				);
			}
			assertCanManageTarget(actor, existingStaff);

			return dependencies.repository.deleteStaff(staffId);
		},

		async restoreStaff(actor: ActingStaffContext, staffId: string) {
			const staff = await dependencies.repository.findAnyById(staffId);
			if (!staff) {
				throw new AppError(
					404,
					'STAFF_NOT_FOUND',
					'The requested staff record could not be found.'
				);
			}
			if (!staff.deletedAt) {
				throw new AppError(409, 'STAFF_NOT_DELETED', 'The staff record is not archived.');
			}
			assertCanManageTarget(actor, staff);
			return dependencies.repository.restoreStaff(staffId);
		},

		async resetMfa(actor: ActingStaffContext, staffId: string): Promise<void> {
			if (actor.id === staffId) {
				throw new AppError(
					409,
					'SELF_UPDATE_NOT_ALLOWED',
					'Staff members must use security settings to change their own MFA.'
				);
			}
			const staff = await dependencies.repository.findById(staffId);
			if (!staff) {
				throw new AppError(
					404,
					'STAFF_NOT_FOUND',
					'The requested staff record could not be found.'
				);
			}
			assertCanManageTarget(actor, staff);
			await dependencies.repository.resetMfa(staffId);
		},

		async resetPassword(actor: ActingStaffContext, staffId: string): Promise<string> {
			if (!actor.roles.includes('admin')) {
				throw new AppError(
					403,
					'FORBIDDEN',
					'Only system administrators can reset staff passwords.'
				);
			}
			if (actor.id === staffId) {
				throw new AppError(
					409,
					'SELF_UPDATE_NOT_ALLOWED',
					'Staff members must use security settings to change their own password.'
				);
			}
			const staff = await dependencies.repository.findById(staffId);
			if (!staff) {
				throw new AppError(
					404,
					'STAFF_NOT_FOUND',
					'The requested staff record could not be found.'
				);
			}
			const password = generatePassword();
			await dependencies.repository.setPassword(
				staffId,
				await dependencies.passwordHasher.hash(password)
			);
			return password;
		}
	};
}

export type StaffService = ReturnType<typeof createStaffService>;
