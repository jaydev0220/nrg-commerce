import {
	closeDatabaseClient,
	createDatabaseClient,
	permissionDefinitions,
	roleDefinitions
} from '../src/index.js';

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
	} finally {
		await database.$disconnect();
		await closeDatabaseClient();
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
