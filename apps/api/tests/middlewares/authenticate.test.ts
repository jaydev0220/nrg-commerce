import assert from 'node:assert/strict';
import test from 'node:test';

import express from 'express';

import { errorHandler } from '../../src/errors/error-handler.js';
import { createAuthenticateMiddleware } from '../../src/middlewares/authenticate.js';
import type { AuthenticatedStaffContext } from '../../src/types/auth.js';
import { requestApp } from '../helpers/http.js';

const authContext: AuthenticatedStaffContext = {
	staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
	sessionId: '0189076c-4f2a-7fe1-b9fd-2d68df455222',
	roles: ['admin'],
	permissions: ['product.read'],
	mfa: ['authenticator'],
	primaryFactor: 'password' as const,
	staff: {} as never
};

test('authenticate middleware reads the access token from an HttpOnly cookie', async () => {
	let receivedToken: string | null = null;
	const app = express();
	app.use(
		createAuthenticateMiddleware({
			authenticateAccessToken: async (token) => {
				receivedToken = token;
				return authContext;
			}
		})
	);
	app.get('/protected', (_request, response) => response.status(204).send());
	app.use(errorHandler);

	const response = await requestApp(app, {
		path: '/protected',
		headers: { cookie: 'admin_access_token=cookie-access-token' }
	});

	assert.equal(response.status, 204);
	assert.equal(receivedToken, 'cookie-access-token');
});

test('authenticate middleware does not accept bearer tokens without an auth cookie', async () => {
	const app = express();
	app.use(
		createAuthenticateMiddleware({
			authenticateAccessToken: async () => authContext
		})
	);
	app.get('/protected', (_request, response) => response.status(204).send());
	app.use(errorHandler);

	const response = await requestApp(app, {
		path: '/protected',
		headers: { authorization: 'Bearer browser-readable-token' }
	});

	assert.equal(response.status, 401);
	assert.equal(response.json<{ error: { code: string } }>().error.code, 'AUTHENTICATION_REQUIRED');
});
