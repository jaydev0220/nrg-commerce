import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const destructiveSql =
	/\b(drop\s+(table|column|schema|database)|truncate\s+table|alter\s+table[^;]+drop)\b/iu;

export async function checkMigrations(directory = 'packages/database/prisma/migrations') {
	const entries = await readdir(directory, { withFileTypes: true });
	const violations = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const sqlPath = join(directory, entry.name, 'migration.sql');
		let sql;
		try {
			sql = await readFile(sqlPath, 'utf8');
		} catch {
			continue;
		}
		if (destructiveSql.test(sql)) violations.push(sqlPath);
	}
	if (violations.length > 0)
		throw new Error(
			`Destructive migration requires manual expand-contract review: ${violations.join(', ')}`
		);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await checkMigrations();
