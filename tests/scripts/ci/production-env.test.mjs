import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProductionEnvironment } from '../../../scripts/ci/production-env.mjs';

const validEnvironment = {
	LANDING_SITE_URL: 'https://www.example.com',
	LANDING_DOMAIN: 'www.example.com',
	CATALOG_DOMAIN: 'catalog.example.com',
	CONTACT_DOMAIN: 'contact.example.com',
	ADMIN_DOMAIN: 'admin.example.com',
	CATALOG_API_BASE_URL: 'https://api.example.com',
	ADMIN_API_BASE_URL: 'https://api.example.com',
	CDN_BASE_URL: 'https://cdn.example.com',
	COOKIE_DOMAIN: 'example.com',
	FACEBOOK_URL: 'https://www.facebook.com/example',
	LINE_URL: 'https://line.me/ti/p/example',
	TURNSTILE_SITE_KEY: 'site-key',
	CLOUDFLARE_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
	CLOUDFLARE_API_TOKEN: 'api-token',
	DEPLOYMENT_ENVIRONMENT: 'production',
	TF_CLOUD_ORGANIZATION: 'example-organization',
	TF_CLOUD_PROJECT: 'nrg-commerce',
	TF_WORKSPACE: 'nrg-commerce-production',
	HCP_TERRAFORM_TOKEN: 'hcp-token'
};

test('validates landing content and Cloudflare deployment values', () => {
	assert.deepEqual(validateProductionEnvironment('landing', validEnvironment), {
		landingSiteUrl: 'https://www.example.com',
		landingDomain: 'www.example.com',
		catalogUrl: 'https://catalog.example.com',
		contactUrl: 'https://contact.example.com',
		cdnBaseUrl: 'https://cdn.example.com',
		cookieDomain: 'example.com',
		facebookUrl: 'https://www.facebook.com/example',
		lineUrl: 'https://line.me/ti/p/example',
		turnstileSiteKey: 'site-key',
		cloudflareAccountId: '0123456789abcdef0123456789abcdef'
	});
});

test('rejects a landing domain that differs from the public site URL', () => {
	assert.throws(
		() =>
			validateProductionEnvironment('landing', {
				...validEnvironment,
				LANDING_DOMAIN: 'other.example.com'
			}),
		/LANDING_DOMAIN must match/u
	);
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
		cloudflareAccountId: '0123456789abcdef0123456789abcdef'
	});
});

test('validates the contact domain and its smoke-test origin', () => {
	assert.deepEqual(validateProductionEnvironment('contact', validEnvironment), {
		landingSiteUrl: 'https://www.example.com',
		contactDomain: 'contact.example.com',
		cloudflareAccountId: '0123456789abcdef0123456789abcdef'
	});
});

test('validates admin API and Cloudflare deployment values', () => {
	assert.deepEqual(validateProductionEnvironment('admin', validEnvironment), {
		adminDomain: 'admin.example.com',
		adminApiBaseUrl: 'https://api.example.com',
		cloudflareAccountId: '0123456789abcdef0123456789abcdef'
	});
});

test('validates infrastructure state and environment selection', () => {
	assert.deepEqual(validateProductionEnvironment('infrastructure', validEnvironment), {
		deploymentEnvironment: 'production',
		adminDomain: 'admin.example.com',
		hcpTerraformOrganization: 'example-organization',
		hcpTerraformProject: 'nrg-commerce',
		hcpTerraformWorkspace: 'nrg-commerce-production',
		cloudflareAccountId: '0123456789abcdef0123456789abcdef'
	});
});

test('rejects malformed Cloudflare account IDs and deployment environments', () => {
	assert.throws(
		() =>
			validateProductionEnvironment('infrastructure', {
				...validEnvironment,
				CLOUDFLARE_ACCOUNT_ID: 'account-id',
				DEPLOYMENT_ENVIRONMENT: 'preview'
			}),
		/DEPLOYMENT_ENVIRONMENT[\s\S]*CLOUDFLARE_ACCOUNT_ID/u
	);
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
	assert.throws(
		() =>
			validateProductionEnvironment('admin', {
				...validEnvironment,
				ADMIN_API_BASE_URL: 'https://api.example.com/management'
			}),
		/ADMIN_API_BASE_URL/
	);
});

test('rejects loopback production URLs and domains', () => {
	assert.throws(
		() =>
			validateProductionEnvironment('admin', {
				...validEnvironment,
				ADMIN_API_BASE_URL: 'https://localhost'
			}),
		/ADMIN_API_BASE_URL/u
	);
	assert.throws(
		() =>
			validateProductionEnvironment('contact', {
				...validEnvironment,
				CONTACT_DOMAIN: '127.0.0.1'
			}),
		/CONTACT_DOMAIN/u
	);
});
