import assert from 'node:assert/strict';
import test from 'node:test';

import express from 'express';

import {
	createAuthCookieManager,
	getPublicAuthResult,
	getPublicPasskeyOptions,
	getPublicTotpSetup
} from '../../src/utils/auth-cookies.js';
import { requestApp } from '../helpers/http.js';

const cookieManager = createAuthCookieManager({
	secure: true,
	sameSite: 'none',
	accessMaxAgeSeconds: 900,
	refreshMaxAgeSeconds: 604_800,
	flowMaxAgeSeconds: 300
});

function setCookies(response: Awaited<ReturnType<typeof requestApp>>): string[] {
	const header = response.headers['set-cookie'];
	assert.ok(header);
	return Array.isArray(header) ? header : [header];
}

test('authenticated results become HttpOnly cookies without exposing tokens in JSON', async () => {
	const app = express();
	app.post('/login', (_request, response) => {
		const result = {
			status: 'authenticated' as const,
			accessToken: 'access-secret',
			refreshToken: 'refresh-secret',
			session: {} as never,
			staff: {} as never
		};
		cookieManager.applyAuthResult(response, result);
		response.status(200).json(getPublicAuthResult(result));
	});

	const response = await requestApp(app, { method: 'POST', path: '/login' });
	const body = response.json<Record<string, unknown>>();
	const cookies = setCookies(response).join('\n');

	assert.deepEqual(body, { status: 'authenticated' });
	assert.equal(JSON.stringify(body).includes('secret'), false);
	assert.match(cookies, /admin_access_token=access-secret/);
	assert.match(cookies, /admin_refresh_token=refresh-secret/);
	assert.match(cookies, /HttpOnly/i);
	assert.match(cookies, /Secure/i);
	assert.match(cookies, /SameSite=None/i);
});

test('MFA flow tokens and methods stay in HttpOnly cookies', async () => {
	const app = express();
	app.post('/challenge', (_request, response) => {
		const result = {
			status: 'mfa_required' as const,
			method: 'authenticator' as const,
			availableMethods: ['authenticator' as const],
			pendingToken: 'pending-secret'
		};
		cookieManager.applyAuthResult(response, result);
		response.status(202).json(getPublicAuthResult(result));
	});

	const response = await requestApp(app, { method: 'POST', path: '/challenge' });
	const cookies = setCookies(response).join('\n');

	assert.deepEqual(response.json(), {
		status: 'mfa_required',
		method: 'authenticator',
		availableMethods: ['authenticator']
	});
	assert.match(cookies, /admin_mfa_pending_token=pending-secret/);
	assert.doesNotMatch(cookies, /admin_mfa_pending_method=/);
	assert.equal(response.text().includes('pending-secret'), false);
});

test('passkey ceremony and TOTP setup tokens are omitted from public responses', () => {
	assert.deepEqual(
		getPublicPasskeyOptions({ ceremonyToken: 'ceremony-secret', options: { challenge: 'public' } }),
		{ options: { challenge: 'public' } }
	);
	assert.deepEqual(
		getPublicTotpSetup({
			setupToken: 'setup-secret',
			secret: 'totp-secret',
			otpauthUrl: 'otpauth://totp/example',
			digits: 6,
			period: 30
		}),
		{
			secret: 'totp-secret',
			otpauthUrl: 'otpauth://totp/example',
			digits: 6,
			period: 30
		}
	);
});
