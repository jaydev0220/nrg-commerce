import { pathToFileURL } from 'node:url';

const contactSecretNames = [
	'ALLOWED_ORIGINS',
	'CONTACT_RECIPIENT_EMAIL',
	'CONTACT_SENDER_EMAIL',
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

function validateEmail(name, value) {
	if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
		throw new Error(`${name} must be a valid email address.`);
	}
}

function validateAllowedOrigins(value) {
	const origins = value
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
	if (origins.length === 0) throw new Error('ALLOWED_ORIGINS must contain at least one origin.');

	for (const origin of origins) {
		try {
			const url = new URL(origin);
			if (
				url.protocol !== 'https:' ||
				isLoopbackHostname(url.hostname) ||
				url.username ||
				url.password ||
				url.pathname !== '/' ||
				url.search ||
				url.hash ||
				origin !== url.origin
			) {
				throw new Error('invalid origin');
			}
		} catch {
			throw new Error('ALLOWED_ORIGINS must contain comma-separated HTTPS origins.');
		}
	}
}

export function readContactSecrets(environment) {
	const missing = contactSecretNames.filter((name) => !environment[name]?.trim());
	if (missing.length > 0) {
		throw new Error(`Missing contact Worker secrets: ${missing.join(', ')}.`);
	}

	validateAllowedOrigins(environment.ALLOWED_ORIGINS.trim());
	validateEmail('CONTACT_RECIPIENT_EMAIL', environment.CONTACT_RECIPIENT_EMAIL.trim());
	validateEmail('CONTACT_SENDER_EMAIL', environment.CONTACT_SENDER_EMAIL.trim());

	return Object.fromEntries(contactSecretNames.map((name) => [name, environment[name]]));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	process.stdout.write(JSON.stringify(readContactSecrets(process.env)));
}
