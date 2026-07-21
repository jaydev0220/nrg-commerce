import assert from 'node:assert/strict';
import test from 'node:test';

import { readAppConfig } from '../../src/config/app-config.js';

const validProductionEnvironment = {
	NODE_ENV: 'production',
	DATABASE_URL: 'postgresql://api:password@database.example.com:5432/nrg_commerce',
	CORS_ORIGINS: 'https://admin.example.com',
	ACCESS_TOKEN_SECRET: 'access-token-secret-0123456789abcdef',
	REFRESH_TOKEN_SECRET: 'refresh-token-secret-0123456789abcdef',
	PENDING_TOKEN_SECRET: 'pending-token-secret-0123456789abcdef',
	DATA_ENCRYPTION_SECRET: 'data-encryption-secret-0123456789abcdef',
	WEBAUTHN_RP_ID: 'example.com',
	WEBAUTHN_RP_NAME: 'NRG Commerce',
	WEBAUTHN_ORIGIN: 'https://admin.example.com',
	R2_ACCOUNT_ID: 'account-id',
	R2_BUCKET_NAME: 'product-assets',
	R2_ACCESS_KEY_ID: 'access-key-id',
	R2_SECRET_ACCESS_KEY: 'r2-secret-access-key',
	R2_PUBLIC_BASE_URL: 'https://cdn.example.com'
} satisfies NodeJS.ProcessEnv;

test('development config supports the admin preview and Vite origins', () => {
	const config = readAppConfig({ NODE_ENV: 'development' });

	assert.equal(config.cookieSecure, false);
	assert.equal(config.cookieSameSite, 'lax');
	assert.equal(config.logLevel, 'debug');
	assert.deepEqual(config.corsOrigins, ['http://localhost:4173', 'http://localhost:5173']);
});

test('production config defaults to cross-origin secure cookies', () => {
	const config = readAppConfig(validProductionEnvironment);

	assert.equal(config.cookieSecure, true);
	assert.equal(config.cookieSameSite, 'none');
	assert.equal(config.logLevel, 'info');
});

test('production config requires every service setting without exposing values', () => {
	assert.throws(
		() => readAppConfig({ NODE_ENV: 'production', ACCESS_TOKEN_SECRET: 'do-not-expose' }),
		(error: Error) => {
			assert.match(error.message, /Production configuration is missing/);
			assert.doesNotMatch(error.message, /do-not-expose/);
			return true;
		}
	);
});

test('production secrets must be strong and pairwise distinct', () => {
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, ACCESS_TOKEN_SECRET: 'short' }),
		/ACCESS_TOKEN_SECRET/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				REFRESH_TOKEN_SECRET: validProductionEnvironment.ACCESS_TOKEN_SECRET
			}),
		/pairwise distinct/
	);
});

test('production origins must use non-local HTTPS URLs', () => {
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, CORS_ORIGINS: 'http://localhost:5173' }),
		/CORS_ORIGINS/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, CORS_ORIGINS: ',' }),
		/CORS_ORIGINS/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				CORS_ORIGINS: 'https://admin.example.com/path'
			}),
		/CORS_ORIGINS/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, WEBAUTHN_RP_ID: 'localhost' }),
		/WEBAUTHN_RP_ID/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, WEBAUTHN_RP_ID: 'example.com/path' }),
		/WEBAUTHN_RP_ID/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, WEBAUTHN_ORIGIN: 'not-a-url' }),
		/WEBAUTHN_ORIGIN/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, R2_PUBLIC_BASE_URL: 'http://cdn.test' }),
		/R2_PUBLIC_BASE_URL/
	);
});

test('production database and cookie settings are validated', () => {
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				DATABASE_URL: 'mysql://database.example.com'
			}),
		/DATABASE_URL/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, COOKIE_SECURE: 'false' }),
		/COOKIE_SECURE/
	);
});

test('database pool size defaults to ten and accepts positive integers', () => {
	assert.equal(readAppConfig({}).databaseMaxConnections, 10);
	assert.equal(readAppConfig({ DATABASE_MAX_CONNECTIONS: '4' }).databaseMaxConnections, 4);
	assert.throws(
		() => readAppConfig({ DATABASE_MAX_CONNECTIONS: '0' }),
		/DATABASE_MAX_CONNECTIONS must be a positive integer/
	);
});

test('configured log levels are accepted', () => {
	assert.equal(readAppConfig({ LOG_LEVEL: 'warn' }).logLevel, 'warn');
});

test('session config provides sliding and absolute lifetime defaults', () => {
	const config = readAppConfig({});

	assert.equal(config.sessionTtlSeconds, 604_800);
	assert.equal(config.sessionAbsoluteTtlSeconds, 2_592_000);
	assert.equal(
		readAppConfig({ SESSION_ABSOLUTE_TTL_SECONDS: '1209600' }).sessionAbsoluteTtlSeconds,
		1_209_600
	);
});

test('storefront cache configuration has bounded defaults and accepts positive integers', () => {
	const defaults = readAppConfig({});
	assert.equal(defaults.storefrontCacheTtlSeconds, 60);
	assert.equal(defaults.storefrontCacheMaxEntries, 500);

	const configured = readAppConfig({
		STOREFRONT_CACHE_TTL_SECONDS: '30',
		STOREFRONT_CACHE_MAX_ENTRIES: '25'
	});
	assert.equal(configured.storefrontCacheTtlSeconds, 30);
	assert.equal(configured.storefrontCacheMaxEntries, 25);
	assert.equal(readAppConfig({ STOREFRONT_CACHE_TTL_SECONDS: '0' }).storefrontCacheTtlSeconds, 60);
});

test('unsupported log levels fail configuration loading', () => {
	assert.throws(
		() => readAppConfig({ LOG_LEVEL: 'verbose' }),
		/LOG_LEVEL must be one of debug, info, warn, error, or fatal/
	);
});

test('SameSite none cookies require the Secure attribute', () => {
	assert.throws(
		() =>
			readAppConfig({
				COOKIE_SECURE: 'false',
				COOKIE_SAME_SITE: 'none'
			}),
		/COOKIE_SECURE must be true/
	);
});
