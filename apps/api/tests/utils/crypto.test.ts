import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { describe, test } from 'node:test';

import {
	createDataCipher,
	hashRefreshToken,
	verifyLegacyScryptHash
} from '../../src/utils/crypto.js';

describe('authentication cryptography', () => {
	test('hashes refresh tokens deterministically without returning the source token', () => {
		const first = hashRefreshToken('refresh-token');
		const second = hashRefreshToken('refresh-token');

		assert.equal(first, second);
		assert.equal(first.length, 64);
		assert.notEqual(first, 'refresh-token');
		assert.notEqual(hashRefreshToken('other-token'), first);
	});

	test('encrypts and authenticates application secrets', () => {
		const cipher = createDataCipher('encryption-secret');
		const encrypted = cipher.encrypt('totp-secret');

		assert.match(encrypted, /^v1\.[^.]+\.[^.]+\.[^.]+$/);
		assert.equal(cipher.decrypt(encrypted), 'totp-secret');
		assert.notEqual(cipher.encrypt('totp-secret'), encrypted);

		const parts = encrypted.split('.');
		parts[3] = parts[3] === 'A' ? 'B' : `${parts[3]}A`;
		assert.throws(() => cipher.decrypt(parts.join('.')));
		assert.throws(() => cipher.decrypt('v2.invalid'));
		assert.throws(() => createDataCipher('different-secret').decrypt(encrypted));
	});

	test('verifies only well-formed legacy scrypt password digests', () => {
		const password = 'correct horse battery staple';
		const salt = 'fixed-test-salt';
		const parameters = { N: 1024, r: 8, p: 1 };
		const hash = scryptSync(password, salt, 32, parameters).toString('hex');
		const digest = `scrypt$${parameters.N}$${parameters.r}$${parameters.p}$${salt}$${hash}`;

		assert.equal(verifyLegacyScryptHash(password, digest), true);
		assert.equal(verifyLegacyScryptHash('wrong password', digest), false);
		assert.equal(verifyLegacyScryptHash(password, 'argon2$payload'), false);
		assert.equal(verifyLegacyScryptHash(password, 'scrypt$1024$8$1$missing-hash'), false);
	});
});
