import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProductionEnvironment } from '../../../scripts/ci/production-env.mjs';

const validEnvironment = {
	LANDING_SITE_URL: 'https://www.example.com',
	CATALOG_DOMAIN: 'catalog.example.com',
	CONTACT_DOMAIN: 'contact.example.com',
	CATALOG_API_BASE_URL: 'https://api.example.com',
	CDN_BASE_URL: 'https://cdn.example.com',
	COOKIE_DOMAIN: 'example.com',
	FACEBOOK_URL: 'https://www.facebook.com/example',
	LINE_URL: 'https://line.me/ti/p/example',
	TURNSTILE_SITE_KEY: 'site-key',
	CLOUDFLARE_ACCOUNT_ID: 'account-id',
	CLOUDFLARE_API_TOKEN: 'api-token'
};

test('validates and normalizes landing production values', () => {
	assert.deepEqual(validateProductionEnvironment('landing', validEnvironment), {
		landingSiteUrl: 'https://www.example.com',
		catalogUrl: 'https://catalog.example.com',
		contactUrl: 'https://contact.example.com',
		cdnBaseUrl: 'https://cdn.example.com',
		cookieDomain: 'example.com',
		facebookUrl: 'https://www.facebook.com/example',
		lineUrl: 'https://line.me/ti/p/example',
		turnstileSiteKey: 'site-key'
	});
});

test('validates catalog API and Cloudflare deployment values', () => {
	assert.deepEqual(validateProductionEnvironment('catalog', validEnvironment), {
		landingSiteUrl: 'https://www.example.com',
		catalogDomain: 'catalog.example.com',
		catalogApiBaseUrl: 'https://api.example.com',
		contactUrl: 'https://contact.example.com',
		cdnBaseUrl: 'https://cdn.example.com',
		cookieDomain: 'example.com',
		facebookUrl: 'https://www.facebook.com/example',
		lineUrl: 'https://line.me/ti/p/example',
		turnstileSiteKey: 'site-key',
		cloudflareAccountId: 'account-id',
		cloudflareApiToken: 'api-token'
	});
});

test('validates the contact domain and its smoke-test origin', () => {
	assert.deepEqual(validateProductionEnvironment('contact', validEnvironment), {
		landingSiteUrl: 'https://www.example.com',
		contactDomain: 'contact.example.com',
		cloudflareAccountId: 'account-id',
		cloudflareApiToken: 'api-token'
	});
});

test('reports missing values by name without exposing configured values', () => {
	assert.throws(
		() => validateProductionEnvironment('contact', { CONTACT_DOMAIN: 'contact.example.com' }),
		(error) => {
			assert.match(error.message, /CLOUDFLARE_ACCOUNT_ID/);
			assert.match(error.message, /CLOUDFLARE_API_TOKEN/);
			assert.doesNotMatch(error.message, /contact\.example\.com/);
			return true;
		}
	);
});

test('rejects insecure production URLs and domains containing paths', () => {
	assert.throws(
		() =>
			validateProductionEnvironment('landing', {
				...validEnvironment,
				LANDING_SITE_URL: 'http://www.example.com'
			}),
		/LANDING_SITE_URL/
	);
	assert.throws(
		() =>
			validateProductionEnvironment('contact', {
				...validEnvironment,
				CONTACT_DOMAIN: 'https:\/\/contact.example.com/path'
			}),
		/CONTACT_DOMAIN/
	);
	assert.throws(
		() =>
			validateProductionEnvironment('landing', {
				...validEnvironment,
				LANDING_SITE_URL: 'https://www.example.com/'
			}),
		/LANDING_SITE_URL/
	);
});
