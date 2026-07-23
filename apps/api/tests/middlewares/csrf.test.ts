import assert from 'node:assert/strict';
import test from 'node:test';

import express from 'express';

import { errorHandler } from '../../src/errors/error-handler.js';
import {
	createCsrfProtectionMiddleware,
	createCsrfTokenHandler
} from '../../src/middlewares/csrf.js';
import { requestApp } from '../helpers/http.js';

const options = {
	allowedOrigins: ['http://localhost:4173'],
	cookieSecure: false,
	cookieSameSite: 'lax' as const,
	cookieMaxAgeSeconds: 3600
};

function getSetCookie(response: Awaited<ReturnType<typeof requestApp>>): string {
	const header = response.headers['set-cookie'];
	assert.ok(header);
	return Array.isArray(header) ? header[0]! : header;
}

test('CSRF endpoint issues an HttpOnly cookie and returns the matching memory token', async () => {
	const app = express();
	app.get('/csrf', createCsrfTokenHandler(options));
	app.use(errorHandler);

	const response = await requestApp(app, { path: '/csrf' });
	const payload = response.json<{ csrfToken: string }>();
	const setCookie = getSetCookie(response);

	assert.equal(response.status, 200);
	assert.match(payload.csrfToken, /^[A-Za-z0-9_-]{40,}$/);
	assert.match(setCookie, new RegExp(`^admin_csrf_token=${payload.csrfToken}`));
	assert.match(setCookie, /HttpOnly/i);
	assert.match(setCookie, /SameSite=Lax/i);
});

test('CSRF endpoint uses a host-prefixed cookie when secure cookies are enabled', async () => {
	const app = express();
	app.get(
		'/csrf',
		createCsrfTokenHandler({
			...options,
			cookieSecure: true,
			cookieSameSite: 'none'
		})
	);
	app.use(errorHandler);

	const response = await requestApp(app, { path: '/csrf' });
	const setCookie = getSetCookie(response);

	assert.equal(response.status, 200);
	assert.match(setCookie, /^__Host-admin_csrf_token=/u);
	assert.match(setCookie, /;\s*Secure(?:;|$)/iu);
	assert.match(setCookie, /;\s*Path=\/(?:;|$)/iu);
	assert.match(setCookie, /;\s*SameSite=None(?:;|$)/iu);
	assert.doesNotMatch(setCookie, /;\s*Domain=/iu);
});

test('CSRF middleware accepts an exact allowed origin and matching cookie/header token', async () => {
	const app = express();
	app.use(createCsrfProtectionMiddleware(options));
	app.post('/protected', (_request, response) => response.status(204).send());
	app.use(errorHandler);

	const response = await requestApp(app, {
		method: 'POST',
		path: '/protected',
		headers: {
			origin: 'http://localhost:4173',
			cookie: 'admin_csrf_token=known-token',
			'x-csrf-token': 'known-token'
		}
	});

	assert.equal(response.status, 204);
});

test('CSRF middleware rejects missing tokens and disallowed origins', async () => {
	const app = express();
	app.use(createCsrfProtectionMiddleware(options));
	app.post('/protected', (_request, response) => response.status(204).send());
	app.use(errorHandler);

	const missingToken = await requestApp(app, {
		method: 'POST',
		path: '/protected',
		headers: { origin: 'http://localhost:4173' }
	});
	const disallowedOrigin = await requestApp(app, {
		method: 'POST',
		path: '/protected',
		headers: {
			origin: 'https://attacker.example',
			cookie: 'admin_csrf_token=known-token',
			'x-csrf-token': 'known-token'
		}
	});
	const missingOrigin = await requestApp(app, {
		method: 'POST',
		path: '/protected',
		headers: {
			cookie: 'admin_csrf_token=known-token',
			'x-csrf-token': 'known-token'
		}
	});

	assert.equal(missingToken.status, 403);
	assert.equal(
		missingToken.json<{ error: { code: string } }>().error.code,
		'CSRF_VALIDATION_FAILED'
	);
	assert.equal(disallowedOrigin.status, 403);
	assert.equal(
		disallowedOrigin.json<{ error: { code: string } }>().error.code,
		'ORIGIN_NOT_ALLOWED'
	);
	assert.equal(missingOrigin.status, 403);
	assert.equal(missingOrigin.json<{ error: { code: string } }>().error.code, 'ORIGIN_NOT_ALLOWED');
});

test('CSRF middleware leaves safe methods untouched', async () => {
	const app = express();
	app.use(createCsrfProtectionMiddleware(options));
	app.get('/protected', (_request, response) => response.status(204).send());
	app.use(errorHandler);

	const response = await requestApp(app, { path: '/protected' });

	assert.equal(response.status, 204);
});
