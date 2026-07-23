import assert from 'node:assert/strict';
import test from 'node:test';

import express, { type RequestHandler } from 'express';

import { errorHandler } from '../../../src/errors/error-handler.js';
import { createRequestContextMiddleware } from '../../../src/middlewares/request-context.js';
import { createAuthRouter } from '../../../src/modules/auth/auth.routes.js';
import type { AuthService } from '../../../src/modules/auth/auth.service.js';
import { createAuthCookieManager } from '../../../src/utils/auth-cookies.js';
import { requestApp } from '../../helpers/http.js';

const staffId = '0189076c-4f2a-7fe1-b9fd-2d68df455111';
const sessionId = '0189076c-4f2a-7fe1-b9fd-2d68df455222';
const staff = {
	id: staffId,
	email: 'admin@example.com',
	name: 'Admin',
	status: 'active',
	passwordHash: 'hidden-password-hash',
	preferredMfaMethod: 'authenticator',
	lastLoginAt: null,
	roles: [],
	totpCredentialCount: 1,
	passkeyCredentialCount: 0
} as never;
const authenticatedResult = {
	status: 'authenticated' as const,
	accessToken: 'access-secret',
	refreshToken: 'refresh-secret',
	session: { id: sessionId } as never,
	staff
};

function createApp(serviceOverrides: Partial<AuthService>) {
	const app = express();
	app.use(express.json());
	app.use(createRequestContextMiddleware());
	const authCookies = createAuthCookieManager({
		secure: false,
		sameSite: 'lax',
		accessMaxAgeSeconds: 900,
		refreshMaxAgeSeconds: 604_800,
		flowMaxAgeSeconds: 300
	});
	const service = serviceOverrides as AuthService;
	const passThrough: RequestHandler = (_request, _response, next) => next();
	app.use(
		createAuthRouter({
			authService: service,
			logService: { recordAuditLog: async () => ({}) as never },
			authRateLimiter: passThrough as never,
			authenticate: passThrough,
			authCookies,
			csrfTokenHandler: (_request, response) => response.json({ csrfToken: 'token' })
		})
	);
	app.use(errorHandler);
	return app;
}

function setCookieText(response: Awaited<ReturnType<typeof requestApp>>): string {
	const header = response.headers['set-cookie'];
	return Array.isArray(header) ? header.join('\n') : String(header ?? '');
}

test('password login stores session tokens in cookies and returns only flow state', async () => {
	const app = createApp({ loginWithPassword: async () => authenticatedResult });
	const response = await requestApp(app, {
		method: 'POST',
		path: '/login/password',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: 'admin@example.com', password: 'long-enough-password' })
	});

	assert.equal(response.status, 200);
	assert.deepEqual(response.json(), { status: 'authenticated' });
	assert.equal(response.text().includes('access-secret'), false);
	assert.match(setCookieText(response), /admin_access_token=access-secret/);
	assert.match(setCookieText(response), /admin_refresh_token=refresh-secret/);
});

test('MFA challenge token is kept in cookies while the method remains public', async () => {
	const app = createApp({
		loginWithPassword: async () => ({
			status: 'mfa_required',
			method: 'authenticator',
			availableMethods: ['authenticator'],
			pendingToken: 'pending-secret'
		})
	});
	const response = await requestApp(app, {
		method: 'POST',
		path: '/login/password',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: 'admin@example.com', password: 'long-enough-password' })
	});

	assert.equal(response.status, 202);
	assert.deepEqual(response.json(), {
		status: 'mfa_required',
		method: 'authenticator',
		availableMethods: ['authenticator']
	});
	assert.equal(response.text().includes('pending-secret'), false);
	assert.match(setCookieText(response), /admin_mfa_pending_token=pending-secret/);
});

test('MFA setup state is kept in a cookie without creating an authenticated session', async () => {
	const app = createApp({
		loginWithPassword: async () => ({
			status: 'mfa_setup_required',
			setupToken: 'setup-secret',
			availableMethods: ['authenticator', 'passkey'],
			staffId
		})
	});
	const response = await requestApp(app, {
		method: 'POST',
		path: '/login/password',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: 'admin@example.com', password: 'long-enough-password' })
	});

	assert.equal(response.status, 202);
	assert.deepEqual(response.json(), {
		status: 'mfa_setup_required',
		availableMethods: ['authenticator', 'passkey']
	});
	assert.equal(response.text().includes('setup-secret'), false);
	assert.doesNotMatch(setCookieText(response), /admin_access_token=[^;\n]+/);
	assert.doesNotMatch(setCookieText(response), /admin_refresh_token=[^;\n]+/);
	assert.match(setCookieText(response), /admin_mfa_setup_token=setup-secret/);

	const state = await requestApp(app, {
		method: 'GET',
		path: '/state',
		headers: { cookie: 'admin_mfa_setup_token=setup-secret' }
	});
	assert.equal(state.status, 200);
	assert.deepEqual(state.json(), {
		status: 'mfa_setup_required',
		availableMethods: ['authenticator', 'passkey']
	});
});

test('passkey options store ceremony state in a cookie', async () => {
	const app = createApp({
		beginPasskeyLogin: async () => ({
			ceremonyToken: 'ceremony-secret',
			options: { challenge: 'public-challenge' } as never
		})
	});
	const response = await requestApp(app, {
		method: 'POST',
		path: '/login/passkey/options',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({})
	});

	assert.deepEqual(response.json(), { options: { challenge: 'public-challenge' } });
	assert.equal(response.text().includes('ceremony-secret'), false);
	assert.match(setCookieText(response), /admin_passkey_ceremony_token=ceremony-secret/);
});

test('passkey verification reads ceremony state from the cookie', async () => {
	let receivedCeremonyToken = '';
	const app = createApp({
		verifyPasskeyLogin: async (input) => {
			receivedCeremonyToken = input.ceremonyToken;
			return authenticatedResult;
		}
	});
	const response = await requestApp(app, {
		method: 'POST',
		path: '/login/passkey/verify',
		headers: {
			'content-type': 'application/json',
			cookie: 'admin_passkey_ceremony_token=cookie-ceremony'
		},
		body: JSON.stringify({ credential: { id: 'credential-id' } })
	});

	assert.equal(response.status, 200);
	assert.equal(receivedCeremonyToken, 'cookie-ceremony');
});

test('session refresh reads and rotates the refresh cookie', async () => {
	let receivedRefreshToken = '';
	let receivedUserAgent = '';
	const app = createApp({
		refreshSession: async (refreshToken, userAgent) => {
			receivedRefreshToken = refreshToken;
			receivedUserAgent = userAgent ?? '';
			return authenticatedResult;
		}
	});
	const response = await requestApp(app, {
		method: 'POST',
		path: '/refresh',
		headers: {
			'content-type': 'application/json',
			cookie: 'admin_refresh_token=cookie-refresh',
			'user-agent': 'a'.repeat(1_000)
		},
		body: '{}'
	});

	assert.equal(response.status, 200);
	assert.equal(receivedRefreshToken, 'cookie-refresh');
	assert.equal(receivedUserAgent, 'a'.repeat(512));
	assert.deepEqual(response.json(), { status: 'authenticated' });
});

test('logout revokes the refresh session and clears every auth cookie', async () => {
	let receivedRefreshToken = '';
	const app = createApp({
		logoutWithRefreshToken: async (refreshToken) => {
			receivedRefreshToken = refreshToken;
		}
	});
	const response = await requestApp(app, {
		method: 'POST',
		path: '/logout',
		headers: { cookie: 'admin_refresh_token=cookie-refresh' }
	});

	assert.equal(response.status, 204);
	assert.equal(receivedRefreshToken, 'cookie-refresh');
	assert.match(setCookieText(response), /admin_access_token=;/);
	assert.match(setCookieText(response), /admin_refresh_token=;/);
});

test('auth state exposes only the non-sensitive flow status', async () => {
	const app = createApp({
		getPendingAuthState: async () => ({
			status: 'mfa_required',
			method: 'authenticator',
			availableMethods: ['authenticator']
		})
	});
	const response = await requestApp(app, {
		path: '/state',
		headers: {
			cookie: 'admin_mfa_pending_token=pending-secret; admin_mfa_pending_method=authenticator'
		}
	});

	assert.deepEqual(response.json(), {
		status: 'mfa_required',
		method: 'authenticator',
		availableMethods: ['authenticator']
	});
	assert.equal(response.text().includes('pending-secret'), false);
});

test('auth state does not treat an invalid access cookie as authenticated', async () => {
	const app = createApp({
		authenticateAccessToken: async () => {
			throw new Error('expired access token');
		}
	});
	const response = await requestApp(app, {
		path: '/state',
		headers: {
			cookie: 'admin_access_token=expired-access; admin_refresh_token=valid-refresh'
		}
	});

	assert.deepEqual(response.json(), { status: 'refresh_required' });
});

test('passkey options accept a username-less request', async () => {
	const app = createApp({
		beginPasskeyLogin: async () => {
			return {
				ceremonyToken: 'ceremony-secret',
				options: { challenge: 'public-challenge' } as never
			};
		}
	});
	const response = await requestApp(app, {
		method: 'POST',
		path: '/login/passkey/options',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({})
	});

	assert.equal(response.status, 200, response.text());

	const emailSpecificResponse = await requestApp(app, {
		method: 'POST',
		path: '/login/passkey/options',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: 'staff@example.com' })
	});
	assert.equal(emailSpecificResponse.status, 422, emailSpecificResponse.text());
});
