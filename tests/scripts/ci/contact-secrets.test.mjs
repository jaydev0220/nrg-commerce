import assert from 'node:assert/strict';
import test from 'node:test';

import { readContactSecrets } from '../../../scripts/ci/contact-secrets.mjs';

const validSecrets = {
	ALLOWED_ORIGINS: 'https://www.example.com',
	CONTACT_RECIPIENT_EMAIL: 'recipient@example.com',
	CONTACT_SENDER_EMAIL: 'sender@example.com',
	TURNSTILE_SECRET_KEY: 'turnstile-secret'
};

test('returns only the required contact Worker secrets', () => {
	assert.deepEqual(readContactSecrets({ ...validSecrets, EXTRA: 'ignored' }), validSecrets);
});

test('reports missing secret names without exposing configured values', () => {
	assert.throws(
		() =>
			readContactSecrets({
				...validSecrets,
				CONTACT_RECIPIENT_EMAIL: '',
				CONTACT_SENDER_EMAIL: undefined
			}),
		(error) => {
			assert.match(error.message, /CONTACT_RECIPIENT_EMAIL/);
			assert.match(error.message, /CONTACT_SENDER_EMAIL/);
			assert.doesNotMatch(error.message, /turnstile-secret|https:\/\//u);
			return true;
		}
	);
});

test('rejects invalid contact Worker origins and email addresses', () => {
	assert.throws(
		() => readContactSecrets({ ...validSecrets, ALLOWED_ORIGINS: 'http://example.com' }),
		/ALLOWED_ORIGINS/
	);
	assert.throws(
		() => readContactSecrets({ ...validSecrets, ALLOWED_ORIGINS: 'https://user@example.com' }),
		/ALLOWED_ORIGINS/
	);
	assert.throws(
		() => readContactSecrets({ ...validSecrets, CONTACT_SENDER_EMAIL: 'not-an-email' }),
		/CONTACT_SENDER_EMAIL/
	);
});

test('rejects loopback contact Worker origins', () => {
	assert.throws(
		() => readContactSecrets({ ...validSecrets, ALLOWED_ORIGINS: 'https://localhost' }),
		/ALLOWED_ORIGINS/u
	);
});
