import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
	assertNoConfigurationErrors,
	confirmedUrl,
	emailAddress,
	fetchWithTimeout,
	positiveInteger,
	readBoundedJson,
	requiredSecret,
	requiredText,
	unconfirmedOrigin
} from './http-operations.mjs';

export class CookieJar {
	#cookies = new Map();

	capture(response) {
		const setCookies = response.headers.getSetCookie?.() ?? [];
		for (const setCookie of setCookies) {
			const [pair, ...attributes] = setCookie.split(';');
			const separator = pair.indexOf('=');
			if (separator <= 0) continue;
			const name = pair.slice(0, separator).trim();
			const value = pair.slice(separator + 1).trim();
			const expires = attributes.some((attribute) => /^\s*max-age=0\s*$/iu.test(attribute));
			if (!value || expires) this.#cookies.delete(name);
			else this.#cookies.set(name, value);
		}
	}

	header() {
		return [...this.#cookies.entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([name, value]) => `${name}=${value}`)
			.join('; ');
	}

	has(name) {
		return this.#cookies.has(name);
	}
}

export function parseVerificationEnvironment(environment) {
	const errors = [];
	const config = {
		apiBaseUrl: confirmedUrl(
			environment,
			'VERIFY_API_BASE_URL',
			'VERIFY_CONFIRMED_API_ORIGIN',
			errors,
			{ rootOnly: true }
		),
		contactUrl: confirmedUrl(
			environment,
			'VERIFY_CONTACT_URL',
			'VERIFY_CONFIRMED_CONTACT_ORIGIN',
			errors,
			{ pathname: '/inquiry' }
		),
		cdnOrigin: confirmedUrl(
			environment,
			'VERIFY_CDN_ORIGIN',
			'VERIFY_CONFIRMED_CDN_ORIGIN',
			errors,
			{ rootOnly: true }
		),
		apiOrigin: unconfirmedOrigin(environment, 'VERIFY_API_ORIGIN', errors),
		contactOrigin: unconfirmedOrigin(environment, 'VERIFY_CONTACT_ORIGIN', errors),
		staffEmail: emailAddress(environment, 'VERIFY_STAFF_EMAIL', errors),
		staffPassword: requiredSecret(environment, 'VERIFY_STAFF_PASSWORD', errors),
		totpCode: requiredText(environment, 'VERIFY_TOTP_CODE', errors, { maximum: 8 }),
		inquiryEmail: emailAddress(environment, 'VERIFY_INQUIRY_EMAIL', errors),
		turnstileToken: requiredText(environment, 'VERIFY_TURNSTILE_TOKEN', errors, {
			maximum: 2048
		}),
		requestTimeoutMs:
			positiveInteger(environment, 'VERIFY_REQUEST_TIMEOUT_SECONDS', 10, errors, {
				minimum: 1,
				maximum: 60
			}) * 1000
	};
	if (config.totpCode && !/^\d{6,8}$/u.test(config.totpCode)) {
		errors.push('VERIFY_TOTP_CODE must contain six to eight digits.');
	}
	assertNoConfigurationErrors(errors, 'Invalid post-deploy verification environment');
	return config;
}

function assertObject(value, label) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${label} returned an invalid response.`);
	}
	return value;
}

async function readExpectedJson(response, label, expectedStatuses) {
	if (!expectedStatuses.includes(response.status)) {
		throw new Error(`${label} failed with HTTP ${response.status}.`);
	}
	return assertObject(await readBoundedJson(response), label);
}

function selectImageUrl(product) {
	const thumbnail = product.thumbnail;
	if (thumbnail && typeof thumbnail === 'object' && typeof thumbnail.imageUrl === 'string') {
		return thumbnail.imageUrl;
	}
	if (Array.isArray(product.images)) {
		const image = product.images.find(
			(candidate) =>
				candidate && typeof candidate === 'object' && typeof candidate.imageUrl === 'string'
		);
		if (image) return image.imageUrl;
	}
	throw new Error('Storefront product does not expose an image for verification.');
}

async function verifyImage(response) {
	if (![200, 206].includes(response.status)) {
		throw new Error(`Product image failed with HTTP ${response.status}.`);
	}
	if (!response.headers.get('content-type')?.toLowerCase().startsWith('image/')) {
		throw new Error('Product image returned an invalid content type.');
	}
	const reader = response.body?.getReader();
	if (!reader) throw new Error('Product image returned an empty body.');
	const firstChunk = await reader.read();
	await reader.cancel();
	if (firstChunk.done || !firstChunk.value?.byteLength) {
		throw new Error('Product image returned an empty body.');
	}
}

export async function verifyDeployment(config, dependencies = {}) {
	const fetchImplementation = dependencies.fetch ?? globalThis.fetch;
	const createId = dependencies.randomUUID ?? randomUUID;
	const jar = new CookieJar();
	let csrfToken = '';
	let authenticated = false;
	const result = {
		liveness: 'pending',
		readiness: 'pending',
		login: 'pending',
		storefrontList: 'pending',
		storefrontDetail: 'pending',
		image: 'pending',
		inquiry: 'pending',
		logout: 'pending'
	};

	const apiRequest = async (path, init = {}) => {
		const headers = new Headers(init.headers);
		headers.set('accept', 'application/json');
		headers.set('origin', config.apiOrigin);
		const cookie = jar.header();
		if (cookie) headers.set('cookie', cookie);
		if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) {
			headers.set('content-type', 'application/json');
			headers.set('x-csrf-token', csrfToken);
		}
		const response = await fetchWithTimeout(
			fetchImplementation,
			`${config.apiBaseUrl}${path}`,
			{ ...init, headers },
			config.requestTimeoutMs
		);
		jar.capture(response);
		if (jar.has('__Host-admin_access_token') || jar.has('admin_access_token')) {
			authenticated = true;
		}
		return response;
	};

	const health = async (path, status, label) => {
		const response = await apiRequest(path);
		const payload = await readExpectedJson(response, label, [200]);
		if (payload.status !== status) throw new Error(`${label} returned an unexpected status.`);
	};

	await health('/health/liveness', 'ok', 'Liveness');
	result.liveness = 'passed';
	await health('/health/readiness', 'ready', 'Readiness');
	result.readiness = 'passed';

	const csrfResponse = await apiRequest('/api/auth/csrf');
	const csrfPayload = await readExpectedJson(csrfResponse, 'CSRF bootstrap', [200]);
	if (typeof csrfPayload.csrfToken !== 'string' || !csrfPayload.csrfToken) {
		throw new Error('CSRF bootstrap returned an invalid token.');
	}
	csrfToken = csrfPayload.csrfToken;

	let verificationError;
	try {
		const passwordResponse = await apiRequest('/api/auth/login/password', {
			method: 'POST',
			body: JSON.stringify({ email: config.staffEmail, password: config.staffPassword })
		});
		const passwordResult = await readExpectedJson(passwordResponse, 'Password login', [200, 202]);
		if (passwordResult.status === 'authenticated') authenticated = true;
		if (passwordResult.status === 'mfa_setup_required') {
			throw new Error('Smoke-test staff requires MFA setup instead of completing authentication.');
		}
		if (
			passwordResult.status !== 'mfa_required' ||
			!Array.isArray(passwordResult.availableMethods) ||
			!passwordResult.availableMethods.includes('authenticator')
		) {
			throw new Error('Smoke-test staff did not require the configured authenticator MFA method.');
		}

		const mfaResponse = await apiRequest('/api/auth/login/mfa/totp', {
			method: 'POST',
			body: JSON.stringify({ code: config.totpCode })
		});
		const mfaResult = await readExpectedJson(mfaResponse, 'Authenticator login', [200]);
		if (mfaResult.status !== 'authenticated') {
			throw new Error('Authenticator login did not complete authentication.');
		}
		authenticated = true;

		const currentStaffResponse = await apiRequest('/api/auth/me');
		const currentStaff = await readExpectedJson(currentStaffResponse, 'Current staff', [200]);
		const staff = assertObject(currentStaff.staff, 'Current staff');
		if (typeof staff.email !== 'string' || staff.email.toLowerCase() !== config.staffEmail) {
			throw new Error('Authenticated staff did not match the smoke-test account.');
		}
		result.login = 'passed';

		const listResponse = await apiRequest('/api/storefront/products?page=1&limit=1');
		const list = await readExpectedJson(listResponse, 'Storefront list', [200]);
		if (!Array.isArray(list.data) || list.data.length === 0) {
			throw new Error('Storefront list did not return a product.');
		}
		const listedProduct = assertObject(list.data[0], 'Storefront list');
		if (typeof listedProduct.slug !== 'string' || !listedProduct.slug) {
			throw new Error('Storefront list returned an invalid product slug.');
		}
		result.storefrontList = 'passed';

		const detailResponse = await apiRequest(
			`/api/storefront/products/${encodeURIComponent(listedProduct.slug)}`
		);
		const product = await readExpectedJson(detailResponse, 'Storefront detail', [200]);
		if (product.slug !== listedProduct.slug) {
			throw new Error('Storefront detail returned a different product.');
		}
		result.storefrontDetail = 'passed';

		const imageUrl = new URL(selectImageUrl(product));
		if (imageUrl.origin !== config.cdnOrigin || imageUrl.username || imageUrl.password) {
			throw new Error('Product image URL did not match the confirmed CDN origin.');
		}
		const imageResponse = await fetchWithTimeout(
			fetchImplementation,
			imageUrl,
			{ headers: { accept: 'image/*', range: 'bytes=0-1023' } },
			config.requestTimeoutMs
		);
		await verifyImage(imageResponse);
		result.image = 'passed';

		const inquiryResponse = await fetchWithTimeout(
			fetchImplementation,
			config.contactUrl,
			{
				method: 'POST',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
					origin: config.contactOrigin
				},
				body: JSON.stringify({
					turnstileToken: config.turnstileToken,
					name: 'Release Verification',
					email: config.inquiryEmail,
					message: `Automated post-deployment verification ${createId()}`
				})
			},
			config.requestTimeoutMs
		);
		const inquiry = await readExpectedJson(inquiryResponse, 'Inquiry acceptance', [202]);
		if (inquiry.ok !== true) throw new Error('Inquiry acceptance returned an invalid response.');
		result.inquiry = 'passed';
	} catch (error) {
		verificationError = error;
	}

	if (authenticated) {
		try {
			const logoutResponse = await apiRequest('/api/auth/logout', {
				method: 'POST',
				body: '{}'
			});
			if (logoutResponse.status !== 204) {
				throw new Error(`Logout failed with HTTP ${logoutResponse.status}.`);
			}
			result.logout = 'passed';
		} catch (error) {
			verificationError ??= error;
		}
	}
	if (verificationError) throw verificationError;

	return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	try {
		const result = await verifyDeployment(parseVerificationEnvironment(process.env));
		for (const [check, status] of Object.entries(result)) {
			process.stdout.write(`${status === 'passed' ? 'PASS' : 'FAIL'} | ${check}\n`);
		}
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : 'Verification failed.'}\n`);
		process.exitCode = 1;
	}
}
