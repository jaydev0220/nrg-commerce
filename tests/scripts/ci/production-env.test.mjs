import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProductionEnvironment } from '../../../scripts/ci/production-env.mjs';

const validEnvironment = {
	DEPLOYMENT_ENVIRONMENT: 'production',
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
	TF_CLOUD_ORGANIZATION: 'example-organization',
	TF_CLOUD_PROJECT: 'nrg-commerce',
	TF_WORKSPACE: 'nrg-commerce-production',
	API_DOMAIN: 'api.example.com',
	AZURE_CLIENT_ID: 'client-id',
	AZURE_TENANT_ID: 'tenant-id',
	AZURE_SUBSCRIPTION_ID: 'subscription-id',
	AZURE_RESOURCE_GROUP: 'rg-nrg-commerce',
	AZURE_LOCATION: 'southeastasia',
	AZURE_CONTAINER_APP_ENVIRONMENT: 'cae-nrg-commerce',
	AZURE_CONTAINER_APP_NAME: 'ca-nrg-commerce-api',
	CLOUDFLARE_ZONE_ID: 'fedcba9876543210fedcba9876543210',
	CORS_ORIGINS: 'https://admin.example.com,https://catalog.example.com',
	TRUSTED_PROXY_CIDRS: '173.245.48.0/20,2606:4700::/32',
	DATABASE_URL: 'postgresql://app:password@db.example.com:5432/app?sslmode=verify-full',
	DIRECT_URL: 'postgresql://app:password@db.example.com:5432/app?sslmode=verify-full',
	ACCESS_TOKEN_SECRET: 'access-token-secret',
	REFRESH_TOKEN_SECRET: 'refresh-token-secret',
	PENDING_TOKEN_SECRET: 'pending-token-secret',
	DATA_ENCRYPTION_SECRET: 'data-encryption-secret',
	R2_ACCESS_KEY_ID: 'r2-access-key',
	R2_SECRET_ACCESS_KEY: 'r2-secret-key',
	WEBAUTHN_ORIGIN: 'https://admin.example.com',
	R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
	OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.com/v1',
	OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=nrg-commerce,deployment.environment.name=production'
};

test('validates each production deployment target without returning secrets', () => {
	assert.deepEqual(validateProductionEnvironment('landing', validEnvironment), {
		landingSiteUrl: 'https://www.example.com',
		landingDomain: 'www.example.com',
		catalogDomain: 'catalog.example.com',
		contactDomain: 'contact.example.com',
		catalogUrl: 'https://catalog.example.com',
		contactUrl: 'https://contact.example.com',
		cdnBaseUrl: 'https://cdn.example.com',
		cookieDomain: 'example.com',
		facebookUrl: 'https://www.facebook.com/example',
		lineUrl: 'https://line.me/ti/p/example',
		turnstileSiteKey: 'site-key',
		cloudflareAccountId: '0123456789abcdef0123456789abcdef'
	});
	assert.equal(
		validateProductionEnvironment('catalog', validEnvironment).catalogApiBaseUrl,
		'https://api.example.com'
	);
	assert.deepEqual(validateProductionEnvironment('contact', validEnvironment), {
		landingSiteUrl: 'https://www.example.com',
		contactDomain: 'contact.example.com',
		turnstileSiteKey: 'site-key',
		cloudflareAccountId: '0123456789abcdef0123456789abcdef'
	});
	assert.deepEqual(validateProductionEnvironment('admin', validEnvironment), {
		adminDomain: 'admin.example.com',
		adminApiBaseUrl: 'https://api.example.com',
		cloudflareAccountId: '0123456789abcdef0123456789abcdef'
	});
	assert.equal(validateProductionEnvironment('api', validEnvironment).apiDomain, 'api.example.com');
	assert.deepEqual(validateProductionEnvironment('infrastructure', validEnvironment), {
		deploymentEnvironment: 'production',
		adminDomain: 'admin.example.com',
		cloudflareZoneId: 'fedcba9876543210fedcba9876543210',
		hcpTerraformOrganization: 'example-organization',
		hcpTerraformProject: 'nrg-commerce',
		hcpTerraformWorkspace: 'nrg-commerce-production',
		cloudflareAccountId: '0123456789abcdef0123456789abcdef'
	});
});

test('rejects staging, malformed CIDRs, insecure URLs, and paths', () => {
	assert.throws(
		() =>
			validateProductionEnvironment('infrastructure', {
				...validEnvironment,
				DEPLOYMENT_ENVIRONMENT: 'staging'
			}),
		/DEPLOYMENT_ENVIRONMENT/u
	);
	assert.throws(
		() =>
			validateProductionEnvironment('api', {
				...validEnvironment,
				TRUSTED_PROXY_CIDRS: 'not-a-cidr'
			}),
		/TRUSTED_PROXY_CIDRS/u
	);
	assert.throws(
		() =>
			validateProductionEnvironment('api', {
				...validEnvironment,
				TRUSTED_PROXY_CIDRS: '10.0.0.0/8/extra'
			}),
		/TRUSTED_PROXY_CIDRS/u
	);
	assert.throws(
		() =>
			validateProductionEnvironment('landing', {
				...validEnvironment,
				LANDING_SITE_URL: 'http://www.example.com'
			}),
		/LANDING_SITE_URL/u
	);
	assert.throws(
		() =>
			validateProductionEnvironment('admin', {
				...validEnvironment,
				ADMIN_API_BASE_URL: 'https://api.example.com/path'
			}),
		/ADMIN_API_BASE_URL/u
	);
});

test('reports missing values by name without exposing secrets', () => {
	assert.throws(
		() => validateProductionEnvironment('api', { ...validEnvironment, DATABASE_URL: '' }),
		(error) => {
			assert.match(error.message, /DATABASE_URL/u);
			assert.doesNotMatch(error.message, /access-token-secret|password/u);
			return true;
		}
	);
});

test('requires a valid Cloudflare zone ID for infrastructure', () => {
	const name = 'CLOUDFLARE_ZONE_ID';
	assert.throws(
		() => validateProductionEnvironment('infrastructure', { ...validEnvironment, [name]: '' }),
		new RegExp(name, 'u')
	);
	assert.throws(
		() =>
			validateProductionEnvironment('infrastructure', { ...validEnvironment, [name]: 'invalid' }),
		new RegExp(name, 'u')
	);
});

test('rejects invalid production domains, origins, database URLs, and account IDs', () => {
	assert.throws(
		() =>
			validateProductionEnvironment('landing', {
				...validEnvironment,
				LANDING_DOMAIN: 'https://www.example.com/path'
			}),
		/LANDING_DOMAIN/u
	);
	assert.throws(
		() =>
			validateProductionEnvironment('landing', {
				...validEnvironment,
				CLOUDFLARE_ACCOUNT_ID: 'not-an-account'
			}),
		/CLOUDFLARE_ACCOUNT_ID/u
	);
	assert.throws(
		() =>
			validateProductionEnvironment('api', {
				...validEnvironment,
				CORS_ORIGINS: 'https://user@example.com'
			}),
		/CORS_ORIGINS/u
	);
	assert.throws(
		() =>
			validateProductionEnvironment('api', {
				...validEnvironment,
				DATABASE_URL: 'postgresql://app:password@db.example.com/app?sslmode=require'
			}),
		/DATABASE_URL/u
	);
	assert.throws(
		() =>
			validateProductionEnvironment('landing', {
				...validEnvironment,
				LANDING_DOMAIN: 'other.example.com'
			}),
		/LANDING_DOMAIN must match/u
	);
});
