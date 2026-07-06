import assert from 'node:assert/strict';
import test from 'node:test';

import {
	accessTokenClaimsSchema,
	passkeyAuthenticationVerificationSchema,
	passwordLoginSchema,
	refreshTokenRequestSchema,
	refreshTokenClaimsSchema,
	staffPasswordUpdateSchema,
	totpSetupConfirmationSchema,
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
		permissions: ['staff.read', 'log.read'],
		mfa: ['passkey'],
		primaryFactor: 'password',
		exp: 1_800_000_000,
		iat: 1_700_000_000
	});

	assert.equal(parsedClaims.type, 'access');
	assert.deepEqual(parsedClaims.permissions, ['staff.read', 'log.read']);
});

test('refreshTokenClaimsSchema rejects access token payloads', () => {
	assert.throws(() =>
		refreshTokenClaimsSchema.parse({
			sub: '9be808ab-bd34-4cf4-b8ae-db0f819ff5e6',
			sid: 'ca7641b9-6856-42b6-99f0-f75f1a4d9e79',
			jti: 'refresh-family-1',
			type: 'access',
			mfa: ['authenticator'],
			primaryFactor: 'password',
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

test('passwordLoginSchema requires an email and a long enough password', () => {
	const parsedPayload = passwordLoginSchema.parse({
		email: 'admin@example.com',
		password: 'correct horse battery staple'
	});

	assert.equal(parsedPayload.email, 'admin@example.com');
	assert.throws(() => passwordLoginSchema.parse({ email: 'admin@example.com', password: 'short' }));
});

test('refreshTokenRequestSchema requires a refresh token string', () => {
	assert.equal(
		refreshTokenRequestSchema.parse({ refreshToken: 'refresh-token-value' }).refreshToken,
		'refresh-token-value'
	);
	assert.throws(() => refreshTokenRequestSchema.parse({ refreshToken: '' }));
});

test('passkey and TOTP ceremony schemas accept opaque tokens and validation codes', () => {
	assert.equal(
		passkeyAuthenticationVerificationSchema.parse({
			ceremonyToken: 'opaque-token',
			credential: { id: 'credential-id' }
		}).ceremonyToken,
		'opaque-token'
	);
	assert.equal(
		totpSetupConfirmationSchema.parse({
			setupToken: 'setup-token',
			code: '123456'
		}).setupToken,
		'setup-token'
	);
});

test('staffPasswordUpdateSchema enforces the admin password update payload', () => {
	assert.equal(
		staffPasswordUpdateSchema.parse({ password: 'correct horse battery staple' }).password,
		'correct horse battery staple'
	);
	assert.throws(() => staffPasswordUpdateSchema.parse({ password: 'tiny' }));
});
