import assert from 'node:assert/strict';
import test from 'node:test';

import {
	accessTokenClaimsSchema,
	refreshTokenClaimsSchema,
	totpCredentialSchema,
	totpChallengeSchema
} from '../src/index.js';

test('accessTokenClaimsSchema accepts the expected JWT claims shape', () => {
	const parsedClaims = accessTokenClaimsSchema.parse({
		sub: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
		sid: 'ca7641b9-6856-42b6-99f0-f75f1a4d9e79',
		jti: 'refresh-family-1',
		type: 'access',
		roles: ['admin'],
		permissions: ['staff.read'],
		mfa: ['passkey'],
		primaryFactor: 'password',
		exp: 1_800_000_000,
		iat: 1_700_000_000
	});

	assert.equal(parsedClaims.type, 'access');
	assert.deepEqual(parsedClaims.permissions, ['staff.read']);
});

test('refreshTokenClaimsSchema rejects access token payloads', () => {
	assert.throws(() =>
		refreshTokenClaimsSchema.parse({
			sub: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
			sid: 'ca7641b9-6856-42b6-99f0-f75f1a4d9e79',
			jti: 'refresh-family-1',
			type: 'access',
			exp: 1_800_000_000,
			iat: 1_700_000_000
		})
	);
});

test('totpChallengeSchema rejects malformed one-time passwords', () => {
	assert.throws(() => totpChallengeSchema.parse({ code: '12ab56' }));
});

test('totpCredentialSchema uses the fixed TOTP shape without label or algorithm fields', () => {
	const parsedCredential = totpCredentialSchema.parse({
		id: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
		staffId: 'ca7641b9-6856-42b6-99f0-f75f1a4d9e79',
		secretEncrypted: 'encrypted-secret',
		digits: 6,
		period: 30,
		verifiedAt: null,
		lastUsedAt: null,
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date()
	});

	assert.equal(parsedCredential.secretEncrypted, 'encrypted-secret');
	assert.equal('label' in parsedCredential, false);
	assert.equal('algorithm' in parsedCredential, false);
});
