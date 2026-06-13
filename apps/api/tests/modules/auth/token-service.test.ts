import assert from 'node:assert/strict';
import test from 'node:test';

import { createTokenService } from '../../../src/utils/token-service.js';

test('createTokenService signs and verifies access tokens with the expected claims', async () => {
	const tokenService = createTokenService({
		accessTokenSecret: 'access-secret',
		refreshTokenSecret: 'refresh-secret',
		pendingTokenSecret: 'pending-secret',
		accessTokenTtlSeconds: 900,
		refreshTokenTtlSeconds: 86_400,
		pendingTokenTtlSeconds: 300
	});

	const accessToken = await tokenService.issueAccessToken({
		sub: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		sid: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
		jti: 'access-jti',
		roles: ['admin'],
		permissions: ['staff.read'],
		mfa: ['authenticator'],
		primaryFactor: 'password'
	});

	const claims = await tokenService.verifyAccessToken(accessToken);

	assert.equal(claims.sub, '0189076c-4f2a-7fe1-b9fd-2d68df455111');
	assert.deepEqual(claims.permissions, ['staff.read']);
	assert.equal(claims.primaryFactor, 'password');
});

test('createTokenService issues refresh and pending-auth tokens with separate claim shapes', async () => {
	const tokenService = createTokenService({
		accessTokenSecret: 'access-secret',
		refreshTokenSecret: 'refresh-secret',
		pendingTokenSecret: 'pending-secret',
		accessTokenTtlSeconds: 900,
		refreshTokenTtlSeconds: 86_400,
		pendingTokenTtlSeconds: 300
	});

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
		requiredMfaMethod: 'authenticator'
	});

	const refreshClaims = await tokenService.verifyRefreshToken(refreshToken);
	const pendingClaims = await tokenService.verifyPendingAuthToken(pendingToken);

	assert.equal(refreshClaims.type, 'refresh');
	assert.equal(pendingClaims.staffId, '0189076c-4f2a-7fe1-b9fd-2d68df455111');
	assert.equal(pendingClaims.requiredMfaMethod, 'authenticator');
});
