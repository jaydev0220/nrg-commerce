import { randomBytes, scryptSync } from 'node:crypto';

import {
	type DatabaseClient,
	closeDatabaseClient,
	createDatabaseClient,
	permissionDefinitions,
	roleDefinitions
} from '../src/index.js';

const defaultSeedAdminName = 'Administrator';

type SeedAdminAccount = {
	email: string;
	name: string;
	password: string;
};

function readOptionalEnv(name: string): string | undefined {
	const value = process.env[name]?.trim();

	if (!value) {
		return undefined;
	}

	return value;
}

function readRequiredEnv(name: string): string {
	const value = readOptionalEnv(name);

	if (value === undefined) {
		throw new Error(`${name} is required to seed the admin account.`);
	}

	return value;
}

function createPasswordHash(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const derivedKey = scryptSync(password, salt, 64).toString('hex');

	return `scrypt$16384$8$1$${salt}$${derivedKey}`;
}

function resolveSeedAdminAccount(): SeedAdminAccount {
	return {
		email: readRequiredEnv('SEED_ADMIN_EMAIL'),
		name: readOptionalEnv('SEED_ADMIN_NAME') ?? defaultSeedAdminName,
		password: readRequiredEnv('SEED_ADMIN_PASSWORD')
	};
}

async function seedAdminAccount(database: DatabaseClient): Promise<void> {
	const seedAdmin = resolveSeedAdminAccount();
	const adminRole = await database.role.findUniqueOrThrow({
		where: {
			key: 'admin'
		},
		select: {
			id: true
		}
	});
	const existingAdmin = await database.staff.findUnique({
		where: {
			email: seedAdmin.email
		},
		select: {
			id: true
		}
	});
	const adminPasswordHash = createPasswordHash(seedAdmin.password);
	const admin =
		existingAdmin === null
			? await database.staff.create({
					data: {
						email: seedAdmin.email,
						name: seedAdmin.name,
						status: 'active',
						passwordHash: adminPasswordHash
					},
					select: {
						id: true
					}
				})
			: await database.staff.update({
					where: {
						email: seedAdmin.email
					},
					data: {
						name: seedAdmin.name,
						status: 'active',
						deletedAt: null,
						passwordHash: adminPasswordHash
					},
					select: {
						id: true
					}
				});

	await database.staffRole.upsert({
		where: {
			staffId_roleId: {
				staffId: admin.id,
				roleId: adminRole.id
			}
		},
		update: {},
		create: {
			staffId: admin.id,
			roleId: adminRole.id
		}
	});
}

async function main(): Promise<void> {
	const database = createDatabaseClient();

	try {
		for (const permission of permissionDefinitions) {
			await database.permission.upsert({
				where: {
					key: permission.key
				},
				update: {
					name: permission.name,
					description: permission.description
				},
				create: permission
			});
		}

		for (const role of roleDefinitions) {
			const roleRecord = await database.role.upsert({
				where: {
					key: role.key
				},
				update: {
					name: role.name,
					description: role.description
				},
				create: {
					key: role.key,
					name: role.name,
					description: role.description
				}
			});

			await database.rolePermission.deleteMany({
				where: {
					roleId: roleRecord.id
				}
			});

			const permissions = await database.permission.findMany({
				where: {
					key: {
						in: [...role.permissions]
					}
				},
				select: {
					id: true
				}
			});

			await database.rolePermission.createMany({
				data: permissions.map((permission) => ({
					roleId: roleRecord.id,
					permissionId: permission.id
				}))
			});
		}

		await seedAdminAccount(database);
	} finally {
		await database.$disconnect();
		await closeDatabaseClient();
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
