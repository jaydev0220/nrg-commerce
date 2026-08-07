import { chmod, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const names = [
	'ALLOWED_ORIGINS',
	'CONTACT_SENDER_EMAIL',
	'CONTACT_RECIPIENT_EMAIL',
	'TURNSTILE_SECRET_KEY'
];

function isLoopbackHostname(hostname) {
	return (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		hostname === '127.0.0.1' ||
		hostname === '[::1]'
	);
}

export function readContactSecrets(environment = process.env) {
	const values = Object.fromEntries(names.map((name) => [name, environment[name]?.trim() ?? '']));
	const missing = names.filter((name) => !values[name]);
	if (missing.length > 0) throw new Error(`Missing contact Worker secrets: ${missing.join(', ')}`);
	for (const origin of values.ALLOWED_ORIGINS.split(',').map((item) => item.trim())) {
		try {
			const url = new URL(origin);
			if (
				url.protocol !== 'https:' ||
				url.username ||
				url.password ||
				url.port ||
				isLoopbackHostname(url.hostname) ||
				url.pathname !== '/' ||
				url.search ||
				url.hash ||
				origin !== url.origin
			)
				throw new Error('invalid origin');
		} catch {
			throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins.');
		}
	}
	for (const name of ['CONTACT_SENDER_EMAIL', 'CONTACT_RECIPIENT_EMAIL']) {
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(values[name]))
			throw new Error(`${name} must be a valid email address.`);
	}
	return values;
}

export const buildContactSecrets = readContactSecrets;

export async function writeContactSecrets(path, environment = process.env) {
	if (!path) throw new Error('Output path is required.');
	const values = readContactSecrets(environment);
	await writeFile(path, `${JSON.stringify(values, null, 2)}\n`, { mode: 0o600 });
	await chmod(path, 0o600);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	await writeContactSecrets(process.argv[2]);
}
