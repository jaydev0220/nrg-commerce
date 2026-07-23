import assert from 'node:assert/strict';
import test from 'node:test';

import { createTokenService } from '../../../src/utils/token-service.js';

const tokenConfig = {
	accessTokenSecret: 'access-secret',
	refreshTokenSecret: 'refresh-secret',
	pendingTokenSecret: 'pending-secret',
	issuer: 'https://api.example.com',
	audience: 'nrg-commerce-admin',
	accessTokenTtlSeconds: 900,
	refreshTokenTtlSeconds: 86_400,
	pendingTokenTtlSeconds: 300
};

test('createTokenService signs and verifies access tokens with the expected claims', async () => {
	const tokenService = createTokenService(tokenConfig);

	const accessToken = await tokenService.issueAccessToken({
		sub: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		sid: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
		jti: 'access-jti',
		roles: ['admin', 'catalog-manager'],
		permissions: ['staff.read', 'product.image.update'],
		mfa: ['authenticator'],
		primaryFactor: 'password'
	});

	const claims = await tokenService.verifyAccessToken(accessToken);

	assert.equal(claims.sub, '0189076c-4f2a-7fe1-b9fd-2d68df455111');
	assert.deepEqual(claims.permissions, ['staff.read', 'product.image.update']);
	assert.deepEqual(claims.roles, ['admin', 'catalog-manager']);
	assert.equal(claims.primaryFactor, 'password');
});

test('createTokenService issues refresh and pending-auth tokens with separate claim shapes', async () => {
	const tokenService = createTokenService(tokenConfig);

	const refreshToken = await tokenService.issueRefreshToken({
		sub: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		sid: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
		jti: 'refresh-jti',
		mfa: ['authenticator'],
		primaryFactor: 'password'
	});
	const pendingToken = await tokenService.issuePendingAuthToken({
		staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		primaryFactor: 'password',
		preferredMfaMethod: 'authenticator',
		availableMfaMethods: ['authenticator', 'passkey']
	});

	const refreshClaims = await tokenService.verifyRefreshToken(refreshToken);
	const pendingClaims = await tokenService.verifyPendingAuthToken(pendingToken);

	assert.equal(refreshClaims.type, 'refresh');
	assert.equal(pendingClaims.staffId, '0189076c-4f2a-7fe1-b9fd-2d68df455111');
	assert.equal(pendingClaims.preferredMfaMethod, 'authenticator');
	assert.deepEqual(pendingClaims.availableMfaMethods, ['authenticator', 'passkey']);
});

test('createTokenService issues ceremony tokens for MFA setup flows', async () => {
	const tokenService = createTokenService(tokenConfig);

	const setupToken = await tokenService.issueCeremonyToken({
		type: 'ceremony',
		purpose: 'mfa_setup',
		staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		primaryFactor: 'password'
	});
	const claims = await tokenService.verifyCeremonyToken<{
		staffId: string;
		primaryFactor: 'password' | 'passkey';
	}>(setupToken, 'mfa_setup');

	assert.equal(claims.staffId, '0189076c-4f2a-7fe1-b9fd-2d68df455111');
	assert.equal(claims.primaryFactor, 'password');
});

test('createTokenService rejects tokens issued for another audience', async () => {
	const issuer = createTokenService(tokenConfig);
	const verifier = createTokenService({ ...tokenConfig, audience: 'another-service' });
	const token = await issuer.issueAccessToken({
		sub: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		sid: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
		jti: 'access-jti',
		roles: ['admin'],
		permissions: ['staff.read'],
		mfa: ['authenticator'],
		primaryFactor: 'password'
	});

	await assert.rejects(() => verifier.verifyAccessToken(token), /aud/u);
});
