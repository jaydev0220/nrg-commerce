import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const controlCharacterPattern = /[\u0000-\u001f\u007f]/u;

export function parsePostgresqlConnection(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error('OWNER_DATABASE_URL must be a PostgreSQL URL with sslmode=verify-full.');
	}
	if (
		!['postgres:', 'postgresql:'].includes(url.protocol) ||
		url.searchParams.get('sslmode') !== 'verify-full' ||
		!url.hostname ||
		!url.username ||
		!url.password ||
		!url.pathname.slice(1)
	)
		throw new Error('OWNER_DATABASE_URL must be a PostgreSQL URL with sslmode=verify-full.');
	const decode = (part) => {
		try {
			return decodeURIComponent(part);
		} catch {
			throw new Error('OWNER_DATABASE_URL contains invalid encoding.');
		}
	};
	const result = {
		host: url.hostname,
		port: Number(url.port || 5432),
		username: decode(url.username),
		password: decode(url.password)
	};
	if (
		!Number.isInteger(result.port) ||
		result.port < 1 ||
		result.port > 65535 ||
		Object.values(result).some(
			(part) => typeof part === 'string' && controlCharacterPattern.test(part)
		)
	)
		throw new Error('OWNER_DATABASE_URL contains unsupported connection fields.');
	return result;
}

export async function writePostgresqlTerraformEnv(path, value = process.env.OWNER_DATABASE_URL) {
	if (!path) throw new Error('GitHub environment file path is required.');
	const connection = parsePostgresqlConnection(value ?? '');
	const lines = [
		`TF_VAR_postgresql_host=${connection.host}`,
		`TF_VAR_postgresql_port=${connection.port}`,
		`TF_VAR_postgresql_username=${connection.username}`,
		`TF_VAR_postgresql_password=${connection.password}`
	];
	await appendFile(path, `${lines.join('\n')}\n`, { mode: 0o600 });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
	await writePostgresqlTerraformEnv(process.argv[2]);
