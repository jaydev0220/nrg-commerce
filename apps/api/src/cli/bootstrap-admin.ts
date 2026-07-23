import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
	closeDatabaseClient,
	createDatabaseClient,
	Prisma,
	type DatabaseClient
} from '@packages/database';
import { normalizedEmailAddressSchema, z } from '@packages/schemas';

import { generateInitialPassword } from '../modules/management/staff/staff.service.js';
import { createPasswordHasher } from '../utils/password-hasher.js';

const bootstrapAdminInputSchema = z.object({
	email: normalizedEmailAddressSchema,
	name: z.string().trim().min(1).max(120).default('Administrator')
});

type BootstrapAdminInput = z.input<typeof bootstrapAdminInputSchema>;

type BootstrapAdminDependencies = {
	generatePassword?: () => string;
	hashPassword?: (password: string) => Promise<string>;
	now?: () => Date;
};

export async function bootstrapAdministrator(
	database: DatabaseClient,
	input: BootstrapAdminInput,
	dependencies: BootstrapAdminDependencies = {}
) {
	const parsedInput = bootstrapAdminInputSchema.parse(input);
	const generatePassword = dependencies.generatePassword ?? generateInitialPassword;
	const hashPassword =
		dependencies.hashPassword ?? ((password: string) => createPasswordHasher().hash(password));
	const now = dependencies.now ?? (() => new Date());
	const initialPassword = generatePassword();
	const passwordHash = await hashPassword(initialPassword);
	const createdAt = now();

	const staff = await database.$transaction(
		async (transaction) => {
			const existingStaff = await transaction.staff.findUnique({
				where: { email: parsedInput.email },
				select: { id: true }
			});
			if (existingStaff) {
				throw new Error('A staff account with this email already exists.');
			}

			const adminRole = await transaction.role.findUnique({
				where: { key: 'admin' },
				select: { id: true }
			});
			if (!adminRole) {
				throw new Error('The admin role is missing. Run the database seed command first.');
			}

			const createdStaff = await transaction.staff.create({
				data: {
					email: parsedInput.email,
					name: parsedInput.name,
					status: 'active',
					passwordHash,
					roles: {
						create: { roleId: adminRole.id }
					}
				},
				select: { id: true, email: true }
			});

			await transaction.log.create({
				data: {
					level: 'info',
					kind: 'audit',
					message: 'Bootstrap administrator created.',
					entityType: 'Staff',
					entityId: createdStaff.id,
					metadata: { source: 'bootstrap-admin' },
					expiresAt: new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1_000)
				}
			});

			return createdStaff;
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
	);

	return {
		staff,
		initialPassword
	};
}

function readCommandInput(): BootstrapAdminInput {
	const { values } = parseArgs({
		options: {
			email: { type: 'string' },
			name: { type: 'string', default: 'Administrator' }
		},
		strict: true
	});

	if (!values.email) {
		throw new Error(
			'Usage: pnpm --filter @apps/api bootstrap:admin -- --email <email> [--name <name>]'
		);
	}

	return {
		email: values.email,
		name: values.name
	};
}

async function main(): Promise<void> {
	const database = createDatabaseClient();

	try {
		const result = await bootstrapAdministrator(database, readCommandInput());
		process.stdout.write(
			`Administrator created.\nEmail: ${result.staff.email}\nInitial password: ${result.initialPassword}\n`
		);
	} finally {
		await database.$disconnect();
		await closeDatabaseClient();
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	void main().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Administrator bootstrap failed.';
		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	});
}
