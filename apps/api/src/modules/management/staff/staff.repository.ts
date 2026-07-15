import type { DatabaseClient, RoleKey } from '@packages/database';

import type { ManagedStaffRecord } from '../../../types/management.js';

type StaffListResult = {
	data: ManagedStaffRecord[];
	total: number;
};

function mapRoleKey(value: string): RoleKey {
	if (value === 'catalog-manager' || value === 'staff-manager' || value === 'sales-manager') {
		return value;
	}

	return 'admin';
}

function mapStaffRecord(staff: {
	id: string;
	email: string;
	name: string;
	status: 'active' | 'inactive' | 'suspended';
	preferredMfaMethod: 'authenticator' | 'passkey' | null;
	lastLoginAt: Date | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	roles: Array<{
		role: {
			id: string;
			key: string;
			name: string;
			rolePermissions: Array<{ permission: { key: string } }>;
		};
	}>;
}): ManagedStaffRecord {
	return {
		id: staff.id,
		email: staff.email,
		name: staff.name,
		status: staff.status,
		preferredMfaMethod: staff.preferredMfaMethod,
		lastLoginAt: staff.lastLoginAt,
		deletedAt: staff.deletedAt,
		createdAt: staff.createdAt,
		updatedAt: staff.updatedAt,
		roles: staff.roles.map(({ role }) => ({
			id: role.id,
			key: mapRoleKey(role.key),
			name: role.name,
			permissions: role.rolePermissions.map(({ permission }) => permission.key)
		}))
	};
}

export function createPrismaStaffRepository(database: DatabaseClient) {
	const includeConfig = {
		roles: {
			include: {
				role: {
					include: {
						rolePermissions: {
							include: {
								permission: true
							}
						}
					}
				}
			}
		}
	} as const;

	return {
		async listStaff(query: {
			page: number;
			limit: number;
			search?: string;
			status?: 'active' | 'inactive' | 'suspended';
			roleId?: string;
			includeDeleted: boolean;
			archived?: boolean;
			sort: 'createdAt' | 'updatedAt' | 'name' | 'email';
			order: 'asc' | 'desc';
		}): Promise<StaffListResult> {
			const where = {
				...(query.archived === true
					? { deletedAt: { not: null } }
					: query.archived === false || !query.includeDeleted
						? { deletedAt: null }
						: {}),
				...(query.search
					? {
							OR: [
								{ name: { contains: query.search, mode: 'insensitive' as const } },
								{ email: { contains: query.search, mode: 'insensitive' as const } }
							]
						}
					: {}),
				...(query.status ? { status: query.status } : {}),
				...(query.roleId ? { roles: { some: { roleId: query.roleId } } } : {})
			};

			const [staffList, total] = await database.$transaction([
				database.staff.findMany({
					where,
					include: includeConfig,
					orderBy: {
						[query.sort]: query.order
					},
					skip: (query.page - 1) * query.limit,
					take: query.limit
				}),
				database.staff.count({ where })
			]);

			return {
				data: staffList.map(mapStaffRecord),
				total
			};
		},

		async findById(staffId: string): Promise<ManagedStaffRecord | null> {
			const staff = await database.staff.findFirst({
				where: {
					id: staffId,
					deletedAt: null
				},
				include: includeConfig
			});

			return staff ? mapStaffRecord(staff) : null;
		},

		async findAnyById(staffId: string): Promise<ManagedStaffRecord | null> {
			const staff = await database.staff.findUnique({
				where: { id: staffId },
				include: includeConfig
			});

			return staff ? mapStaffRecord(staff) : null;
		},

		async listRoles() {
			const roles = await database.role.findMany({
				orderBy: { name: 'asc' },
				include: {
					rolePermissions: {
						include: { permission: true }
					}
				}
			});

			return roles.map((role) => ({
				id: role.id,
				key: mapRoleKey(role.key),
				name: role.name,
				permissions: role.rolePermissions.map(({ permission }) => permission.key)
			}));
		},

		async createStaff(input: {
			email: string;
			name: string;
			roleIds: string[];
			passwordHash: string;
		}): Promise<ManagedStaffRecord> {
			const staff = await database.staff.create({
				data: {
					email: input.email,
					name: input.name,
					status: 'inactive',
					passwordHash: input.passwordHash,
					roles: {
						createMany: {
							data: input.roleIds.map((roleId) => ({
								roleId
							}))
						}
					}
				},
				include: includeConfig
			});

			return mapStaffRecord(staff);
		},

		async updateStaff(
			staffId: string,
			input: {
				email?: string;
				name?: string;
				roleIds?: string[];
				status?: 'active' | 'inactive' | 'suspended';
			}
		): Promise<ManagedStaffRecord> {
			await database.$transaction(async (transaction) => {
				if (input.roleIds) {
					await transaction.staffRole.deleteMany({
						where: {
							staffId
						}
					});
					await transaction.staffRole.createMany({
						data: input.roleIds.map((roleId) => ({
							staffId,
							roleId
						}))
					});
				}

				await transaction.staff.update({
					where: {
						id: staffId
					},
					data: {
						email: input.email,
						name: input.name,
						status: input.status
					}
				});
			});

			const updatedStaff = await this.findById(staffId);

			if (!updatedStaff) {
				throw new Error('Updated staff record could not be found.');
			}

			return updatedStaff;
		},

		async deleteStaff(staffId: string, force: boolean): Promise<'force' | 'soft'> {
			if (force) {
				await database.staff.delete({
					where: {
						id: staffId
					}
				});
				return 'force';
			}

			await database.staff.update({
				where: {
					id: staffId
				},
				data: {
					status: 'inactive',
					deletedAt: new Date()
				}
			});

			return 'soft';
		},

		async restoreStaff(staffId: string): Promise<ManagedStaffRecord> {
			await database.staff.update({
				where: { id: staffId },
				data: { deletedAt: null, status: 'inactive' }
			});

			const staff = await this.findById(staffId);
			if (!staff) throw new Error('Restored staff record could not be found.');
			return staff;
		},

		async resetMfa(staffId: string): Promise<void> {
			const deletedAt = new Date();
			await database.$transaction([
				database.staff.update({
					where: { id: staffId },
					data: { preferredMfaMethod: null }
				}),
				database.totpCredential.updateMany({
					where: { staffId, deletedAt: null },
					data: { deletedAt }
				}),
				database.passkeyCredential.updateMany({
					where: { staffId, deletedAt: null },
					data: { deletedAt }
				}),
				database.authSession.updateMany({
					where: { staffId, revokedAt: null },
					data: { revokedAt: deletedAt }
				})
			]);
		},

		async setPassword(staffId: string, passwordHash: string): Promise<void> {
			const revokedAt = new Date();
			await database.$transaction([
				database.staff.update({
					where: { id: staffId },
					data: { passwordHash }
				}),
				database.authSession.updateMany({
					where: { staffId, revokedAt: null },
					data: { revokedAt }
				}),
				database.refreshToken.updateMany({
					where: { session: { staffId }, revokedAt: null },
					data: { revokedAt }
				})
			]);
		},

		async roleIdsExist(roleIds: string[]): Promise<boolean> {
			const count = await database.role.count({
				where: {
					id: {
						in: roleIds
					}
				}
			});

			return count === roleIds.length;
		},

		async emailExists(email: string, excludeStaffId?: string): Promise<boolean> {
			const count = await database.staff.count({
				where: {
					email,
					...(excludeStaffId
						? {
								id: {
									not: excludeStaffId
								}
							}
						: {})
				}
			});

			return count > 0;
		}
	};
}

export type StaffRepository = ReturnType<typeof createPrismaStaffRepository>;
