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
	HCP_TERRAFORM_TOKEN: 'hcp-token',
	API_DOMAIN: 'api.example.com',
	API_DNS_TF_WORKSPACE: 'nrg-commerce-api-dns-production',
	API_ORIGIN_CERTIFICATE_PFX_BASE64: Buffer.from('test-pfx').toString('base64'),
	API_ORIGIN_CERTIFICATE_PASSWORD: 'certificate-password',
	AZURE_CLIENT_ID: 'client-id',
	AZURE_TENANT_ID: 'tenant-id',
	AZURE_SUBSCRIPTION_ID: 'subscription-id',
	AZURE_RESOURCE_GROUP: 'nrg-commerce-production',
	AZURE_LOCATION: 'eastasia',
	AZURE_CONTAINER_APP_ENVIRONMENT: 'nrg-commerce-production',
	AZURE_CONTAINER_APP_NAME: 'nrg-commerce-api',
	CLOUDFLARE_ZONE_ID: 'fedcba9876543210fedcba9876543210',
	CORS_ORIGINS: 'https://admin.example.com,https://catalog.example.com',
	TRUST_PROXY_HOPS: '1',
	DATABASE_URL: 'postgresql://app:password@db.example.com:5432/app?sslmode=verify-full',
	DIRECT_URL: 'postgresql://app:password@db.example.com:5432/app?sslmode=verify-full',
	ACCESS_TOKEN_SECRET: 'access-token-secret',
	REFRESH_TOKEN_SECRET: 'refresh-token-secret',
	PENDING_TOKEN_SECRET: 'pending-token-secret',
	DATA_ENCRYPTION_SECRET: 'data-encryption-secret',
	R2_ACCESS_KEY_ID: 'r2-access-key',
	R2_SECRET_ACCESS_KEY: 'r2-secret-key',
	WEBAUTHN_ORIGIN: 'https://admin.example.com',
	R2_PUBLIC_BASE_URL: 'https://cdn.example.com/assets',
	OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.com/v1',
	OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=nrg-commerce,deployment.environment.name=production'
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

test('validates API deployment and database values without returning secrets', () => {
	assert.deepEqual(validateProductionEnvironment('api', validEnvironment), {
		deploymentEnvironment: 'production',
		apiDomain: 'api.example.com',
		azureResourceGroup: 'nrg-commerce-production',
		azureLocation: 'eastasia',
		azureContainerAppEnvironment: 'nrg-commerce-production',
		azureContainerAppName: 'nrg-commerce-api',
		apiDnsTerraformWorkspace: 'nrg-commerce-api-dns-production'
	});
});

test('API validation rejects a zero trust proxy hop count to match runtime configuration', () => {
	assert.throws(
		() =>
			validateProductionEnvironment('api', {
				...validEnvironment,
				TRUST_PROXY_HOPS: '0'
			}),
		/TRUST_PROXY_HOPS must be a positive integer/u
	);
});

test('API validation reports missing names without exposing database or token values', () => {
	assert.throws(
		() => validateProductionEnvironment('api', { ...validEnvironment, DATABASE_URL: '' }),
		(error) => {
			assert.match(error.message, /DATABASE_URL/u);
			assert.doesNotMatch(error.message, /access-token-secret|password/u);
			return true;
		}
	);
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
