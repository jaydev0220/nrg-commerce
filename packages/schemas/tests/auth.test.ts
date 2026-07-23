import assert from 'node:assert/strict';
import test from 'node:test';

import {
	accessTokenClaimsSchema,
	mfaPreferenceSchema,
	passkeyAuthenticationStartSchema,
	passkeyAuthenticationVerificationSchema,
	passwordChangeSchema,
	passwordLoginSchema,
	refreshTokenRequestSchema,
	refreshTokenClaimsSchema,
	securityReauthPasswordSchema,
	setupTokenRequestSchema,
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
		roles: ['admin', 'catalog-manager', 'sales-manager'],
		permissions: ['staff.read', 'log.read', 'business.read', 'order.write', 'product.image.update'],
		mfa: ['passkey'],
		primaryFactor: 'password',
		exp: 1_800_000_000,
		iat: 1_700_000_000
	});

	assert.equal(parsedClaims.type, 'access');
	assert.deepEqual(parsedClaims.permissions, [
		'staff.read',
		'log.read',
		'business.read',
		'order.write',
		'product.image.update'
	]);
	assert.deepEqual(parsedClaims.roles, ['admin', 'catalog-manager', 'sales-manager']);
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
		email: ' Admin@Example.COM ',
		password: 'correct horse battery staple'
	});

	assert.equal(parsedPayload.email, 'admin@example.com');
	assert.throws(() => passwordLoginSchema.parse({ email: 'admin@example.com', password: 'short' }));
});

test('password-bearing request schemas reject oversized values', () => {
	const oversizedPassword = 'Aa1!'.repeat(65);

	assert.throws(() =>
		passwordLoginSchema.parse({ email: 'admin@example.com', password: oversizedPassword })
	);
	assert.throws(() =>
		passwordChangeSchema.parse({
			currentPassword: oversizedPassword,
			newPassword: oversizedPassword
		})
	);
	assert.throws(() =>
		securityReauthPasswordSchema.parse({
			action: 'add_totp',
			password: oversizedPassword
		})
	);
});

test('refreshTokenRequestSchema rejects browser-readable refresh tokens', () => {
	assert.deepEqual(refreshTokenRequestSchema.parse({}), {});
	assert.throws(() => refreshTokenRequestSchema.parse({ refreshToken: 'refresh-token-value' }));
});

test('passkey and TOTP schemas keep ceremony tokens out of request bodies', () => {
	assert.deepEqual(passkeyAuthenticationStartSchema.parse({}), {});
	assert.throws(() => passkeyAuthenticationStartSchema.parse({ email: 'staff@example.com' }));
	assert.deepEqual(
		passkeyAuthenticationVerificationSchema.parse({ credential: { id: 'credential-id' } }),
		{ credential: { id: 'credential-id' } }
	);
	assert.deepEqual(totpSetupConfirmationSchema.parse({ code: '123456' }), { code: '123456' });
	assert.deepEqual(setupTokenRequestSchema.parse({}), {});
	assert.throws(() => setupTokenRequestSchema.parse({ setupToken: 'setup-token' }));
});

test('mfaPreferenceSchema requires a configured MFA method', () => {
	assert.deepEqual(mfaPreferenceSchema.parse({ preferredMfaMethod: 'passkey' }), {
		preferredMfaMethod: 'passkey'
	});
	assert.throws(() => mfaPreferenceSchema.parse({}));
});
