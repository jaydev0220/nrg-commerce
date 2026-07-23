import assert from 'node:assert/strict';
import test from 'node:test';

import express from 'express';

import { errorHandler } from '../../src/errors/error-handler.js';
import { requireVerifiedMfa } from '../../src/middlewares/authorize.js';
import type { AuthenticatedStaffContext } from '../../src/types/auth.js';
import { requestApp } from '../helpers/http.js';

function createAuthContext(): AuthenticatedStaffContext {
	return {
		staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		sessionId: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
		roles: ['admin'],
		permissions: [],
		mfa: ['authenticator'],
		primaryFactor: 'password',
		staff: {
			id: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
			email: 'admin@example.com',
			name: 'Admin',
			status: 'active',
			passwordHash: null,
			preferredMfaMethod: 'authenticator',
			lastLoginAt: null,
			failedAuthCount: 0,
			failedAuthWindowStartedAt: null,
			authBlockedUntil: null,
			roles: [],
			totpCredentialCount: 1,
			passkeyCredentialCount: 0
		}
	};
}

async function requestProtectedRoute(authContext: AuthenticatedStaffContext) {
	const app = express();
	app.use((_request, response, next) => {
		response.locals['auth'] = authContext;
		next();
	});
	app.get('/protected', requireVerifiedMfa(), (_request, response) => response.status(204).send());
	app.use(errorHandler);
	return requestApp(app, { path: '/protected' });
}

test('verified MFA requires a current credential in addition to the token claim', async () => {
	const authContext = createAuthContext();
	authContext.staff.totpCredentialCount = 0;

	const response = await requestProtectedRoute(authContext);

	assert.equal(response.status, 403);
	assert.equal(response.json<{ error: { code: string } }>().error.code, 'MFA_SETUP_REQUIRED');
});

test('verified MFA accepts a claim backed by a current credential', async () => {
	const response = await requestProtectedRoute(createAuthContext());

	assert.equal(response.status, 204);
});
