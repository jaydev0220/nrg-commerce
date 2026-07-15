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

		async createStaff(input: { email: string; name: string; roleIds: string[] }) {
			if (await dependencies.repository.emailExists(input.email)) {
				throw new AppError(409, 'EMAIL_CONFLICT', 'The provided staff email is already in use.');
			}

			if (!(await dependencies.repository.roleIdsExist(input.roleIds))) {
				throw new AppError(404, 'ROLE_NOT_FOUND', 'One or more assigned roles could not be found.');
			}

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

			if (input.email && (await dependencies.repository.emailExists(input.email, staffId))) {
				throw new AppError(409, 'EMAIL_CONFLICT', 'The provided staff email is already in use.');
			}

			if (input.roleIds && !(await dependencies.repository.roleIdsExist(input.roleIds))) {
				throw new AppError(404, 'ROLE_NOT_FOUND', 'One or more assigned roles could not be found.');
			}

			if (actor.id === staffId) {
				if (input.status === 'inactive' || input.status === 'suspended') {
					throw new AppError(
						409,
						'SELF_UPDATE_NOT_ALLOWED',
						'Staff members cannot suspend or deactivate their own account.'
					);
				}

				if (input.roleIds && actor.roles.includes('admin')) {
					const administrativeRoleIds = existingStaff.roles
						.filter((role) => role.key === 'admin')
						.map((role) => role.id);
					const retainsAdministrativeAccess = administrativeRoleIds.some((roleId) =>
						input.roleIds?.includes(roleId)
					);

					if (administrativeRoleIds.length > 0 && !retainsAdministrativeAccess) {
						throw new AppError(
							409,
							'SELF_UPDATE_NOT_ALLOWED',
							'Staff members cannot remove their own administrative access.'
						);
					}
				}
			}

			return dependencies.repository.updateStaff(staffId, input);
		},

		async deleteStaff(actor: ActingStaffContext, staffId: string, force: boolean) {
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

			return dependencies.repository.deleteStaff(staffId, force);
		},

		async restoreStaff(staffId: string) {
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
			return dependencies.repository.restoreStaff(staffId);
		},

		async resetMfa(staffId: string): Promise<void> {
			const staff = await dependencies.repository.findById(staffId);
			if (!staff) {
				throw new AppError(
					404,
					'STAFF_NOT_FOUND',
					'The requested staff record could not be found.'
				);
			}
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
		},

		async updatePassword(
			actor: ActingStaffContext,
			staffId: string,
			password: string
		): Promise<void> {
			if (!actor.roles.includes('admin')) {
				throw new AppError(
					403,
					'FORBIDDEN',
					'Only system administrators can reset staff passwords.'
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

			const passwordHash = await dependencies.passwordHasher.hash(password);
			await dependencies.repository.setPassword(staffId, passwordHash);
		}
	};
}

export type StaffService = ReturnType<typeof createStaffService>;
