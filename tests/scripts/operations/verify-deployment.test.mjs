import assert from 'node:assert/strict';
import test from 'node:test';

import {
	CookieJar,
	parseVerificationEnvironment,
	verifyDeployment
} from '../../../scripts/operations/verify-deployment.mjs';

const validEnvironment = {
	VERIFY_API_BASE_URL: 'https://api.staging.example.com',
	VERIFY_CONTACT_URL: 'https://contact.staging.example.com/inquiry',
	VERIFY_CDN_ORIGIN: 'https://cdn.staging.example.com',
	VERIFY_API_ORIGIN: 'https://admin.staging.example.com',
	VERIFY_CONTACT_ORIGIN: 'https://catalog.staging.example.com',
	VERIFY_CONFIRMED_API_ORIGIN: 'https://api.staging.example.com',
	VERIFY_CONFIRMED_CONTACT_ORIGIN: 'https://contact.staging.example.com',
	VERIFY_CONFIRMED_CDN_ORIGIN: 'https://cdn.staging.example.com',
	VERIFY_STAFF_EMAIL: 'operator@example.com',
	VERIFY_STAFF_PASSWORD: 'private-password',
	VERIFY_TOTP_CODE: '123456',
	VERIFY_INQUIRY_EMAIL: 'delivery-sink@example.com',
	VERIFY_TURNSTILE_TOKEN: 'private-turnstile-token'
};

function jsonResponse(value, init = {}) {
	return new Response(JSON.stringify(value), {
		...init,
		headers: { 'content-type': 'application/json', ...init.headers }
	});
}

test('verification configuration requires exact confirmation of remote request targets', () => {
	assert.throws(
		() =>
			parseVerificationEnvironment({
				...validEnvironment,
				VERIFY_CONFIRMED_CDN_ORIGIN: 'https://cdn.example.com'
			}),
		/VERIFY_CONFIRMED_CDN_ORIGIN/u
	);
});

test('verification configuration rejects control characters without exposing secrets', () => {
	assert.throws(
		() =>
			parseVerificationEnvironment({
				...validEnvironment,
				VERIFY_STAFF_PASSWORD: 'private-password\nInjected: value'
			}),
		(error) => {
			assert.ok(error instanceof Error);
			assert.doesNotMatch(error.message, /private-password|private-turnstile-token/u);
			return true;
		}
	);
});

test('cookie jar retains current cookies and removes expired cookies', () => {
	const jar = new CookieJar();
	jar.capture({
		headers: {
			getSetCookie: () => [
				'__Host-csrf=csrf-value; Path=/; Secure; HttpOnly',
				'__Host-access=access-value; Path=/; Secure; HttpOnly'
			]
		}
	});
	assert.equal(jar.header(), '__Host-access=access-value; __Host-csrf=csrf-value');

	jar.capture({
		headers: {
			getSetCookie: () => ['__Host-access=; Max-Age=0; Path=/; Secure; HttpOnly']
		}
	});
	assert.equal(jar.header(), '__Host-csrf=csrf-value');
});

test('post-deploy verification exercises every required flow once and logs out', async () => {
	const config = parseVerificationEnvironment(validEnvironment);
	const requests = [];
	const fetch = async (input, init = {}) => {
		const url = new URL(input);
		const headers = new Headers(init.headers);
		const body = init.body ? JSON.parse(init.body) : null;
		requests.push({ url: url.href, method: init.method ?? 'GET', headers, body });

		if (url.pathname === '/health/liveness') return jsonResponse({ status: 'ok' });
		if (url.pathname === '/health/readiness') return jsonResponse({ status: 'ready' });
		if (url.pathname === '/api/auth/csrf') {
			return jsonResponse(
				{ csrfToken: 'csrf-token' },
				{ headers: { 'set-cookie': '__Host-csrf=csrf-cookie; Path=/; Secure; HttpOnly' } }
			);
		}
		if (url.pathname === '/api/auth/login/password') {
			assert.equal(headers.get('origin'), 'https://admin.staging.example.com');
			assert.deepEqual(body, {
				email: 'operator@example.com',
				password: 'private-password'
			});
			return jsonResponse(
				{
					status: 'mfa_required',
					method: 'authenticator',
					availableMethods: ['authenticator']
				},
				{ status: 202, headers: { 'set-cookie': '__Host-pending=pending; Path=/; Secure' } }
			);
		}
		if (url.pathname === '/api/auth/login/mfa/totp') {
			assert.deepEqual(body, { code: '123456' });
			return jsonResponse(
				{ status: 'authenticated' },
				{
					headers: {
						'set-cookie': '__Host-admin_access_token=access; Path=/; Secure; HttpOnly'
					}
				}
			);
		}
		if (url.pathname === '/api/auth/me') {
			return jsonResponse({ staff: { email: 'operator@example.com' } });
		}
		if (url.pathname === '/api/storefront/products' && !url.searchParams.has('slug')) {
			return jsonResponse({
				data: [
					{
						slug: 'sample-product',
						thumbnail: { imageUrl: 'https://cdn.staging.example.com/products/image.webp' },
						images: []
					}
				]
			});
		}
		if (url.pathname === '/api/storefront/products/sample-product') {
			return jsonResponse({
				slug: 'sample-product',
				thumbnail: { imageUrl: 'https://cdn.staging.example.com/products/image.webp' },
				images: []
			});
		}
		if (url.origin === 'https://cdn.staging.example.com') {
			return new Response(new Uint8Array([1, 2, 3]), {
				headers: { 'content-type': 'image/webp' }
			});
		}
		if (url.href === 'https://contact.staging.example.com/inquiry') {
			assert.equal(headers.get('origin'), 'https://catalog.staging.example.com');
			return jsonResponse({ ok: true }, { status: 202 });
		}
		if (url.pathname === '/api/auth/logout') return new Response(null, { status: 204 });
		throw new Error(`Unexpected request path: ${url.pathname}`);
	};

	const result = await verifyDeployment(config, {
		fetch,
		randomUUID: () => '00000000-0000-4000-8000-000000000001'
	});

	assert.deepEqual(result, {
		liveness: 'passed',
		readiness: 'passed',
		login: 'passed',
		storefrontList: 'passed',
		storefrontDetail: 'passed',
		image: 'passed',
		inquiry: 'passed',
		logout: 'passed'
	});
	assert.equal(requests.filter(({ url }) => url.endsWith('/api/auth/login/password')).length, 1);
	assert.equal(requests.filter(({ url }) => url.endsWith('/inquiry')).length, 1);
	for (const request of requests.filter(({ method }) => method !== 'GET')) {
		if (request.url.endsWith('/inquiry')) continue;
		assert.equal(request.headers.get('x-csrf-token'), 'csrf-token');
	}
});

test('post-deploy verification rejects accounts that still require MFA setup', async () => {
	const config = parseVerificationEnvironment(validEnvironment);
	const fetch = async (input) => {
		const pathname = new URL(input).pathname;
		if (pathname === '/health/liveness') return jsonResponse({ status: 'ok' });
		if (pathname === '/health/readiness') return jsonResponse({ status: 'ready' });
		if (pathname === '/api/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' });
		if (pathname === '/api/auth/login/password') {
			return jsonResponse(
				{ status: 'mfa_setup_required', availableMethods: ['authenticator'] },
				{ status: 202 }
			);
		}
		throw new Error(`Unexpected request path: ${pathname}`);
	};

	await assert.rejects(
		() => verifyDeployment(config, { fetch }),
		/MFA setup instead of completing authentication/u
	);
});

test('post-deploy verification logs out when password authentication bypasses MFA', async () => {
	const config = parseVerificationEnvironment(validEnvironment);
	let logoutCalls = 0;
	const fetch = async (input) => {
		const pathname = new URL(input).pathname;
		if (pathname === '/health/liveness') return jsonResponse({ status: 'ok' });
		if (pathname === '/health/readiness') return jsonResponse({ status: 'ready' });
		if (pathname === '/api/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' });
		if (pathname === '/api/auth/login/password') {
			return jsonResponse(
				{ status: 'authenticated' },
				{
					headers: {
						'set-cookie': '__Host-admin_access_token=access; Path=/; Secure; HttpOnly'
					}
				}
			);
		}
		if (pathname === '/api/auth/logout') {
			logoutCalls += 1;
			return new Response(null, { status: 204 });
		}
		throw new Error(`Unexpected request path: ${pathname}`);
	};

	await assert.rejects(
		() => verifyDeployment(config, { fetch }),
		/did not require the configured authenticator MFA method/u
	);
	assert.equal(logoutCalls, 1);
});

test('post-deploy verification logs out when an authentication response is malformed', async () => {
	const config = parseVerificationEnvironment(validEnvironment);
	let logoutCalls = 0;
	const fetch = async (input) => {
		const pathname = new URL(input).pathname;
		if (pathname === '/health/liveness') return jsonResponse({ status: 'ok' });
		if (pathname === '/health/readiness') return jsonResponse({ status: 'ready' });
		if (pathname === '/api/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' });
		if (pathname === '/api/auth/login/password') {
			return jsonResponse(
				{
					status: 'mfa_required',
					method: 'authenticator',
					availableMethods: ['authenticator']
				},
				{ status: 202 }
			);
		}
		if (pathname === '/api/auth/login/mfa/totp') {
			return new Response('not-json', {
				status: 200,
				headers: {
					'content-type': 'application/json',
					'set-cookie': '__Host-admin_access_token=access; Path=/; Secure; HttpOnly'
				}
			});
		}
		if (pathname === '/api/auth/logout') {
			logoutCalls += 1;
			return new Response(null, { status: 204 });
		}
		throw new Error(`Unexpected request path: ${pathname}`);
	};

	await assert.rejects(() => verifyDeployment(config, { fetch }), /not valid JSON/u);
	assert.equal(logoutCalls, 1);
});

test('post-deploy verification logs out after downstream failure without hiding that failure', async () => {
	const config = parseVerificationEnvironment(validEnvironment);
	let logoutCalls = 0;
	const fetch = async (input) => {
		const pathname = new URL(input).pathname;
		if (pathname === '/health/liveness') return jsonResponse({ status: 'ok' });
		if (pathname === '/health/readiness') return jsonResponse({ status: 'ready' });
		if (pathname === '/api/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' });
		if (pathname === '/api/auth/login/password') {
			return jsonResponse(
				{
					status: 'mfa_required',
					method: 'authenticator',
					availableMethods: ['authenticator']
				},
				{ status: 202 }
			);
		}
		if (pathname === '/api/auth/login/mfa/totp') {
			return jsonResponse({ status: 'authenticated' });
		}
		if (pathname === '/api/auth/me') {
			return jsonResponse({ staff: { email: 'operator@example.com' } });
		}
		if (pathname === '/api/storefront/products') {
			return jsonResponse({ data: [] });
		}
		if (pathname === '/api/auth/logout') {
			logoutCalls += 1;
			return jsonResponse({ error: 'logout failed' }, { status: 500 });
		}
		throw new Error(`Unexpected request path: ${pathname}`);
	};

	await assert.rejects(
		() => verifyDeployment(config, { fetch }),
		/Storefront list did not return a product/u
	);
	assert.equal(logoutCalls, 1);
});
